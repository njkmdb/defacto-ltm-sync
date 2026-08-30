import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import (
    MemorySearchRequest, MemorySearchResponse, GenerateBriefingRequest,
    SaveBriefingRequest, BriefingListResponse, BriefingAuditTrailResponse, SaveSummaryResponse,
    UpdateBriefingRequest, BulkDeleteBriefingRequest
)
from services import memory_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Memory Explorer & Briefings"])

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

@router.post("/memory-search", response_model=MemorySearchResponse)
async def search_memory_explorer(request: MemorySearchRequest, db: Session = Depends(get_db)):
    try: return await memory_service.search_memory_explorer(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-briefing")
async def generate_event_briefing(request: GenerateBriefingRequest, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    try: return await memory_service.generate_event_briefing(request, db, target_lang)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-briefing")
async def save_event_briefing(request: SaveBriefingRequest, db: Session = Depends(get_db)):
    try: return memory_service.save_event_briefing(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.get("/briefings", response_model=BriefingListResponse)
def get_event_briefings(page: int = 1, limit: int = 20, base_entity_id: Optional[int] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, search_conditions: Optional[str] = None, db: Session = Depends(get_db)):
    try: return memory_service.get_event_briefings(db, page, limit, base_entity_id, start_date, end_date, search_conditions)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.get("/briefings/{briefing_id}/audit-trail", response_model=BriefingAuditTrailResponse)
def get_briefing_audit_trail(briefing_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try: return memory_service.get_briefing_audit_trail(briefing_id, base_entity_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.get("/briefings/{briefing_id}")
def get_event_briefing_by_id(briefing_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try: return memory_service.get_event_briefing(briefing_id, base_entity_id, db)
    except Exception as e: raise HTTPException(status_code=404, detail=str(e))

@router.patch("/briefings/{briefing_id}", response_model=SaveSummaryResponse)
def update_event_briefing(briefing_id: int, request: UpdateBriefingRequest, db: Session = Depends(get_db)):
    try: return memory_service.update_event_briefing(briefing_id, request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/briefings/{briefing_id}", response_model=SaveSummaryResponse)
def delete_event_briefing(briefing_id: int, base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try: return memory_service.delete_event_briefing(briefing_id, base_entity_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/briefings/bulk-delete", response_model=SaveSummaryResponse)
def delete_bulk_event_briefings(request: BulkDeleteBriefingRequest, db: Session = Depends(get_db)):
    try: return memory_service.delete_bulk_event_briefings(request.briefing_ids, request.base_entity_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))