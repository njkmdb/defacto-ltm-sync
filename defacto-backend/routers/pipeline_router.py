import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import (
    StructureEventsRequest, StructureEventsResponse,
    SynthesizeContextRequest, SynthesizeContextResponse,
    PipelineStatusResponse, FactCheckRequest, FactCheckSchema
)
from services import pipeline_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Pipeline Engine"])

@router.post("/structure-events", response_model=StructureEventsResponse)
async def structure_events(request: StructureEventsRequest, db: Session = Depends(get_db)):
    return await pipeline_service.process_structure_events(request, db)

@router.post("/synthesize-context", response_model=SynthesizeContextResponse)
async def synthesize_context(request: SynthesizeContextRequest, db: Session = Depends(get_db)):
    return await pipeline_service.process_synthesize_context(request, db)

@router.get("/pipeline-status", response_model=PipelineStatusResponse)
def get_pipeline_status(
    base_entity_id: int = Query(..., description="보안 검증용"), # 💡 쿼리 파라미터 강제 추가
    page: int = 1, limit: int = 20, 
    start_date: Optional[str] = None, end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return pipeline_service.get_pipeline_status(db, base_entity_id, page, limit, start_date, end_date, status_filter)

@router.post("/fact-check", response_model=FactCheckSchema)
async def fact_check(request: FactCheckRequest, db: Session = Depends(get_db)):
    return await pipeline_service.process_fact_check(request, db)