import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from database.database import get_db, SessionLocal
from database.models import EventRaw
from schemas.api_schemas import (
    CreateRawEventRequest, UpdateRawEventRequest, RawEventResponse,
    BulkDeleteRequest, StructureEventsRequest,
    RawEventStatusResponse, ImpactAnalysisResponse
)
from services import raw_event_service, pipeline_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Raw Events"])

async def run_pipeline_background(base_entity_id: int, raw_id: int, schema_name: str):
    db: Session = SessionLocal()
    try:
        request = StructureEventsRequest(base_entity_id=base_entity_id, target_raw_ids=[raw_id], schema_name=schema_name, retry_failed=True)
        await pipeline_service.process_structure_events(request, db)
    except Exception as e:
        logger.error(f"[Background Task] Error: {str(e)}")
    finally:
        db.close() 

@router.post("/raw-events", response_model=RawEventResponse)
async def create_raw_event(request: CreateRawEventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        result = await raw_event_service.create_raw_event(request, db)
        if request.run_pipeline_now:
            background_tasks.add_task(run_pipeline_background, result["base_entity_id"], result["raw_id"], request.schema_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/raw-events/{raw_id}", response_model=RawEventResponse)
async def update_raw_event(raw_id: int, request: UpdateRawEventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        result = await raw_event_service.update_raw_event(raw_id, request, db)
        if request.run_pipeline_now:
            background_tasks.add_task(run_pipeline_background, result["base_entity_id"], raw_id, request.schema_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/raw-events/{raw_id}/impact", response_model=ImpactAnalysisResponse)
def get_raw_event_impact(raw_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try:
        return raw_event_service.analyze_raw_event_impact(raw_id, base_entity_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/raw-events/{raw_id}/status", response_model=RawEventStatusResponse)
def get_raw_event_status(raw_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try:
        return raw_event_service.get_raw_event_status(raw_id, base_entity_id, db)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/raw-events/{raw_id}")
def get_raw_event_detail(raw_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try:
        raw_record = db.query(EventRaw).filter(
            EventRaw.raw_id == raw_id,
            EventRaw.base_entity_id == base_entity_id
        ).first()
        if not raw_record:
            raise HTTPException(status_code=404, detail="해당 데이터를 찾을 수 없거나 접근 권한이 없습니다.")
        return {
            "status": "success",
            "data": {
                "raw_id": raw_record.raw_id,
                "base_entity_id": raw_record.base_entity_id,
                "event_date": raw_record.event_date,
                "raw_content": raw_record.raw_content,
                "sync_status_id": raw_record.sync_status_id,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/raw-events/{raw_id}", response_model=RawEventResponse)
async def delete_raw_event(raw_id: int, base_entity_id: int = Query(..., description="보안 검증용"), cascade_mode: str = Query("SOFT_DISCONNECT"), db: Session = Depends(get_db)):
    try: 
        return await raw_event_service.delete_raw_event(raw_id, base_entity_id, cascade_mode, db)
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/raw-events/bulk-delete", response_model=RawEventResponse)
async def delete_bulk_raw_events(request: BulkDeleteRequest, db: Session = Depends(get_db)):
    try: 
        return await raw_event_service.delete_bulk_raw_events(request.raw_ids, request.base_entity_id, db)
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))