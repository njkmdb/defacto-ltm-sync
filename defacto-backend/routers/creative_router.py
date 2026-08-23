import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.creative_schemas import (
    GenerateCreativeRequest, SaveCreativeRequest, EventCreationListResponse, GenerateMetaPromptRequest
)
from schemas.common_schemas import SaveSummaryResponse
from services import creative_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Creative Studio"])

@router.post("/creative/generate")
async def generate_creative_content(request: GenerateCreativeRequest, db: Session = Depends(get_db)):
    try:
        return await creative_service.generate_creative_content(request, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/creative/save", response_model=SaveSummaryResponse)
def save_creative_content(request: SaveCreativeRequest, db: Session = Depends(get_db)):
    try:
        return creative_service.save_creative_content(request, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/creative", response_model=EventCreationListResponse)
def get_event_creations(
    page: int = 1, limit: int = 20, 
    base_entity_id: Optional[int] = None, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None, 
    search_conditions: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        return creative_service.get_event_creations(db, page, limit, base_entity_id, start_date, end_date, search_conditions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/creative/{creation_id}", response_model=SaveSummaryResponse)
def delete_event_creation(creation_id: int, db: Session = Depends(get_db)):
    try:
        return creative_service.delete_event_creation(creation_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/meta-prompt")
async def generate_meta_prompt(request: GenerateMetaPromptRequest):
    try:
        return await creative_service.generate_creative_meta_prompt(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 💡 [NEW] 2차 창작물 단건 조회 (3차 창작용 데이터 불러오기 용도)
@router.get("/creative/{creation_id}")
def get_event_creation(creation_id: int, db: Session = Depends(get_db)):
    try:
        return creative_service.get_event_creation(creation_id, db)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))