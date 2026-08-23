import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from database.database import get_db, SessionLocal
from schemas.api_schemas import (
    CreateRawEventRequest, UpdateRawEventRequest, RawEventResponse,
    BulkDeleteRequest, StructureEventsRequest
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

@router.delete("/raw-events/{raw_id}", response_model=RawEventResponse)
async def delete_raw_event(raw_id: int, db: Session = Depends(get_db)):
    try: 
        return await raw_event_service.delete_raw_event(raw_id, db)
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/raw-events/bulk-delete", response_model=RawEventResponse)
async def delete_bulk_raw_events(request: BulkDeleteRequest, db: Session = Depends(get_db)):
    try: 
        return await raw_event_service.delete_bulk_raw_events(request.raw_ids, db)
    except Exception as e: 
        raise HTTPException(status_code=500, detail=str(e))