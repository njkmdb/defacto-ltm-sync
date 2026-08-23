import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import (
    SaveSummaryResponse, PromptListResponse, CreatePromptRequest, UpdatePromptRequest
)
from services import prompt_service
from services.pipeline_service import DEFAULT_PROMPTS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Prompt Lab"])

# 💡 [NEW] 프론트엔드 편집기를 위해 하드코딩된 기본 프롬프트 딕셔너리를 노출합니다.
@router.get("/prompts/defaults")
def get_default_prompts():
    return {"status": "success", "data": DEFAULT_PROMPTS}

@router.get("/prompts", response_model=PromptListResponse)
def get_prompts(page: int = 1, limit: int = 20, target_type: Optional[str] = None, pipeline_step: Optional[str] = None, db: Session = Depends(get_db)):
    return prompt_service.get_prompts(db, page, limit, target_type, pipeline_step)

@router.post("/prompts", response_model=SaveSummaryResponse)
def create_prompt(request: CreatePromptRequest, db: Session = Depends(get_db)):
    try: return prompt_service.create_prompt(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.patch("/prompts/{prompt_id}", response_model=SaveSummaryResponse)
def update_prompt(prompt_id: int, request: UpdatePromptRequest, db: Session = Depends(get_db)):
    try: return prompt_service.update_prompt(prompt_id, request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/prompts/{prompt_id}", response_model=SaveSummaryResponse)
def delete_prompt(prompt_id: int, db: Session = Depends(get_db)):
    try: return prompt_service.delete_prompt(prompt_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))