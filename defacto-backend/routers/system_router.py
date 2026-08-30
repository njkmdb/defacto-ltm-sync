import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import SystemConfigResponse, SystemSettingsResponse, UpdateSystemSettingsRequest, SaveSummaryResponse
from services import system_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["System Data Explorer"])

@router.get("/system/config", response_model=SystemConfigResponse)
def get_system_config():
    return system_service.get_system_config()

@router.get("/system/tables/{schema_name}")
def get_tables(schema_name: str, db: Session = Depends(get_db)):
    return system_service.get_tables(schema_name, db)

@router.get("/system/data/{schema_name}/{table_name}")
def get_table_data(
    schema_name: str, 
    table_name: str, 
    page: int = Query(1, ge=1), 
    limit: int = Query(50, ge=1, le=500),
    search_conditions: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return system_service.get_table_data(schema_name, table_name, page, limit, search_conditions, db)

# 👇 [추가된 부분]
@router.get("/system/settings", response_model=SystemSettingsResponse)
def get_system_settings():
    settings = system_service.get_dynamic_settings()
    return {"api_key": settings.get("GEMINI_API_KEY", ""), "model_name": settings.get("MODEL_NAME", "")}

@router.post("/system/settings", response_model=SaveSummaryResponse)
def update_system_settings(request: UpdateSystemSettingsRequest):
    return system_service.update_dynamic_settings(request.api_key, request.model_name)