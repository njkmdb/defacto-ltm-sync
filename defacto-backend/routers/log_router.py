import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import (
    SaveSummaryRequest, SaveSummaryResponse,
    EventLogListResponse, BulkDeleteLogRequest, BulkUpsertLogRequest
)
from services import log_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["AI Event Logs"])

@router.post("/save-summary", response_model=SaveSummaryResponse)
def save_summary(request: SaveSummaryRequest, db: Session = Depends(get_db)):
    return log_service.save_edited_summary(request, db)

@router.get("/event-logs", response_model=EventLogListResponse)
def get_event_logs(page: int = 1, limit: int = 20, start_date: Optional[str] = None, end_date: Optional[str] = None, search_conditions: Optional[str] = None, db: Session = Depends(get_db)):
    return log_service.get_event_logs(db, page, limit, start_date, end_date, search_conditions)

@router.delete("/event-logs/{log_id}", response_model=SaveSummaryResponse)
def delete_event_log(log_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try: return log_service.delete_event_log(log_id, base_entity_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/event-logs/bulk-delete", response_model=SaveSummaryResponse)
def delete_bulk_event_logs(request: BulkDeleteLogRequest, db: Session = Depends(get_db)):
    try: return log_service.delete_bulk_event_logs(request.log_ids, request.base_entity_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/event-logs/bulk-upsert", response_model=SaveSummaryResponse)
def bulk_upsert_event_logs(request: BulkUpsertLogRequest, db: Session = Depends(get_db)):
    try: return log_service.bulk_upsert_event_logs(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.get("/event-logs/{log_id}")
def get_event_log_by_id(log_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try:
        return log_service.get_event_log(log_id, base_entity_id, db)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))