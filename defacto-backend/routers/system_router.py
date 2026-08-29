import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.database import get_db
from services import system_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["System Data Explorer"])

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