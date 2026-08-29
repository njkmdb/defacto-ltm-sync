import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import DashboardStatisticsResponse, SystemInsightsResponse
from services import dashboard_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Dashboard Insights"])

@router.get("/statistics", response_model=DashboardStatisticsResponse)
def get_dashboard_statistics(base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try:
        return dashboard_service.get_dashboard_statistics(db, base_entity_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/insights", response_model=SystemInsightsResponse)
def get_system_insights(base_entity_id: int = Query(..., description="보안 검증용"), db: Session = Depends(get_db)):
    try:
        return dashboard_service.get_system_insights(db, base_entity_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))