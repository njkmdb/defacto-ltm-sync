import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Header
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

def get_target_language(
    accept_language: Optional[str] = Header(None),
    x_target_language: Optional[str] = Header(None)
) -> str:
    if x_target_language:
        return x_target_language
    if accept_language:
        primary_lang = accept_language.split(',')[0].split('-')[0].lower()
        if primary_lang == 'ja': return "Japanese"
        elif primary_lang == 'ko': return "Korean"
        elif primary_lang == 'en': return "English"
    return "Korean"

async def run_pipeline_background(base_entity_id: int, raw_id: int, schema_name: str, target_lang: str):
    db: Session = SessionLocal()
    try:
        request = StructureEventsRequest(base_entity_id=base_entity_id, target_raw_ids=[raw_id], schema_name=schema_name, retry_failed=True)
        await pipeline_service.process_structure_events(request, db, target_lang)
    except Exception as e:
        logger.error(f"[Background Task] Error: {str(e)}")
    finally:
        db.close() 

@router.post("/raw-events", response_model=RawEventResponse)
async def create_raw_event(request: CreateRawEventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    try:
        result = await raw_event_service.create_raw_event(request, db)
        if request.run_pipeline_now:
            background_tasks.add_task(run_pipeline_background, result["base_entity_id"], result["raw_id"], request.schema_name, target_lang)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/raw-events/{raw_id}", response_model=RawEventResponse)
async def update_raw_event(raw_id: int, request: UpdateRawEventRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    try:
        result = await raw_event_service.update_raw_event(raw_id, request, db)
        if request.run_pipeline_now:
            background_tasks.add_task(run_pipeline_background, result["base_entity_id"], raw_id, request.schema_name, target_lang)
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