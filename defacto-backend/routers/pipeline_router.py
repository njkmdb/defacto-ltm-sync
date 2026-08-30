import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query, Header
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

@router.post("/structure-events", response_model=StructureEventsResponse)
async def structure_events(request: StructureEventsRequest, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    return await pipeline_service.process_structure_events(request, db, target_lang)

@router.post("/synthesize-context", response_model=SynthesizeContextResponse)
async def synthesize_context(request: SynthesizeContextRequest, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    return await pipeline_service.process_synthesize_context(request, db, target_lang)

@router.get("/pipeline-status", response_model=PipelineStatusResponse)
def get_pipeline_status(
    base_entity_id: int = Query(..., description="보안 검증용"),
    page: int = 1, limit: int = 20, 
    start_date: Optional[str] = None, end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return pipeline_service.get_pipeline_status(db, base_entity_id, page, limit, start_date, end_date, status_filter)

@router.post("/fact-check", response_model=FactCheckSchema)
async def fact_check(request: FactCheckRequest, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    return await pipeline_service.process_fact_check(request, db, target_lang)