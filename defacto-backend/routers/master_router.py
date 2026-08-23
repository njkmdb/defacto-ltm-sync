import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from schemas.api_schemas import (
    SaveSummaryResponse, MstEntityListResponse, CreateMstEntityRequest, UpdateMstEntityRequest,
    MstObjectListResponse, CreateMstObjectRequest, UpdateMstObjectRequest,
    BulkDeleteMasterRequest, MasterTypeListResponse,
    BulkUpsertMstEntityRequest, BulkUpsertMstObjectRequest,
    MstStatusListResponse, MstStatusOptionsResponse, CreateMstStatusRequest, UpdateMstStatusRequest, BulkUpsertMstStatusRequest
)
# 💡 핵심: 세분화된 마스터 서비스들을 임포트
from services import mst_entity_service, mst_object_service, mst_status_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Master Data Control"])

# ----- Status Master API -----
@router.get("/statuses/options", response_model=MstStatusOptionsResponse)
def get_status_options(category: str, db: Session = Depends(get_db)):
    return mst_status_service.get_active_status_options(category, db)

@router.get("/statuses", response_model=MstStatusListResponse)
def get_statuses(page: int = 1, limit: int = 20, category_filter: Optional[str] = None, search_conditions: Optional[str] = None, db: Session = Depends(get_db)):
    return mst_status_service.get_mst_statuses(db, page, limit, category_filter, search_conditions)

@router.post("/statuses", response_model=SaveSummaryResponse)
def create_status(request: CreateMstStatusRequest, db: Session = Depends(get_db)):
    try: return mst_status_service.create_mst_status(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.patch("/statuses/{status_id}", response_model=SaveSummaryResponse)
def update_status(status_id: int, request: UpdateMstStatusRequest, db: Session = Depends(get_db)):
    try: return mst_status_service.update_mst_status(status_id, request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/statuses/{status_id}", response_model=SaveSummaryResponse)
def delete_status(status_id: int, db: Session = Depends(get_db)):
    try: return mst_status_service.delete_mst_status(status_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/statuses/bulk-delete", response_model=SaveSummaryResponse)
def delete_bulk_statuses(request: BulkDeleteMasterRequest, db: Session = Depends(get_db)):
    try: return mst_status_service.delete_bulk_mst_statuses(request.target_ids, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/statuses/bulk-upsert", response_model=SaveSummaryResponse)
def bulk_upsert_statuses(request: BulkUpsertMstStatusRequest, db: Session = Depends(get_db)):
    try: return mst_status_service.bulk_upsert_mst_statuses(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# ----- Entity Master API -----
@router.get("/entities/types", response_model=MasterTypeListResponse)
def get_entity_types(db: Session = Depends(get_db)):
    return mst_entity_service.get_mst_entity_types(db)

@router.get("/entities", response_model=MstEntityListResponse)
def get_entities(page: int = 1, limit: int = 20, type_filter: Optional[str] = None, search_conditions: Optional[str] = None, db: Session = Depends(get_db)):
    return mst_entity_service.get_mst_entities(db, page, limit, type_filter, search_conditions)

@router.post("/entities", response_model=SaveSummaryResponse)
def create_entity(request: CreateMstEntityRequest, db: Session = Depends(get_db)):
    try: return mst_entity_service.create_mst_entity(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.patch("/entities/{entity_id}", response_model=SaveSummaryResponse)
def update_entity(entity_id: int, request: UpdateMstEntityRequest, db: Session = Depends(get_db)):
    try: return mst_entity_service.update_mst_entity(entity_id, request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/entities/{entity_id}", response_model=SaveSummaryResponse)
def delete_entity(entity_id: int, db: Session = Depends(get_db)):
    try: return mst_entity_service.delete_mst_entity(entity_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/entities/bulk-delete", response_model=SaveSummaryResponse)
def delete_bulk_entities(request: BulkDeleteMasterRequest, db: Session = Depends(get_db)):
    try: return mst_entity_service.delete_bulk_mst_entities(request.target_ids, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/entities/bulk-upsert", response_model=SaveSummaryResponse)
def bulk_upsert_entities(request: BulkUpsertMstEntityRequest, db: Session = Depends(get_db)):
    try: return mst_entity_service.bulk_upsert_mst_entities(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# ----- Object Master API -----
@router.get("/objects/types", response_model=MasterTypeListResponse)
def get_object_types(db: Session = Depends(get_db)):
    return mst_object_service.get_mst_object_types(db)

@router.get("/objects", response_model=MstObjectListResponse)
def get_objects(page: int = 1, limit: int = 20, type_filter: Optional[str] = None, search_conditions: Optional[str] = None, db: Session = Depends(get_db)):
    return mst_object_service.get_mst_objects(db, page, limit, type_filter, search_conditions)

@router.post("/objects", response_model=SaveSummaryResponse)
def create_object(request: CreateMstObjectRequest, db: Session = Depends(get_db)):
    try: return mst_object_service.create_mst_object(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.patch("/objects/{object_id}", response_model=SaveSummaryResponse)
def update_object(object_id: int, request: UpdateMstObjectRequest, db: Session = Depends(get_db)):
    try: return mst_object_service.update_mst_object(object_id, request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.delete("/objects/{object_id}", response_model=SaveSummaryResponse)
def delete_object(object_id: int, db: Session = Depends(get_db)):
    try: return mst_object_service.delete_mst_object(object_id, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/objects/bulk-delete", response_model=SaveSummaryResponse)
def delete_bulk_objects(request: BulkDeleteMasterRequest, db: Session = Depends(get_db)):
    try: return mst_object_service.delete_bulk_mst_objects(request.target_ids, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@router.post("/objects/bulk-upsert", response_model=SaveSummaryResponse)
def bulk_upsert_objects(request: BulkUpsertMstObjectRequest, db: Session = Depends(get_db)):
    try: return mst_object_service.bulk_upsert_mst_objects(request, db)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))