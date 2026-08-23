import logging
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from database.models import EventRaw, BatchJob, ExtSyncHistory
from schemas.api_schemas import (
    BulkSynthesizeRequest, BulkSynthesizeResponse,
    BatchJobStatusResponse, ForceSyncResponse, ExtSyncHistoryItem,
    UpdateIntervalRequest
)
from services.pipeline_service import bulk_synthesize_task
from services.scheduler_service import run_ext_sync_job, get_ext_sync_interval, update_ext_sync_interval

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Scheduler & Batch"])

@router.post("/bulk-synthesize", response_model=BulkSynthesizeResponse, status_code=202)
async def trigger_bulk_synthesize(request: BulkSynthesizeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        # 해당 일자에 비정형 데이터(EventRaw)가 있는 base_entity_id 목록 조회
        raws = db.query(EventRaw.base_entity_id).filter(EventRaw.event_date == request.reference_date).distinct().all()
        entity_ids = [r[0] for r in raws]
        
        job_id = str(uuid.uuid4())
        total_count = len(entity_ids)
        
        new_job = BatchJob(
            job_id=job_id,
            job_type="BULK_SYNTHESIS",
            status="RUNNING",
            total_count=total_count,
            current_count=0
        )
        db.add(new_job)
        db.commit()
        
        if total_count > 0:
            background_tasks.add_task(bulk_synthesize_task, job_id, request.reference_date, entity_ids)
        else:
            new_job.status = "COMPLETED"
            db.commit()
            
        return {"job_id": job_id, "total_count": total_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batch-jobs/{job_id}", response_model=BatchJobStatusResponse)
def get_batch_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(BatchJob).filter(BatchJob.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "total_count": job.total_count,
        "current_count": job.current_count,
        "error_log": job.error_log
    }

@router.post("/scheduler/force-sync", response_model=ForceSyncResponse)
async def force_ext_sync(background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(run_ext_sync_job, "MANUAL")
        return {"status": "success", "message": "마이크로 배치 강제 트리거 완료"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scheduler/history", response_model=List[ExtSyncHistoryItem])
def get_scheduler_history(limit: int = 5, db: Session = Depends(get_db)):
    history = db.query(ExtSyncHistory).order_by(ExtSyncHistory.start_ts.desc()).limit(limit).all()
    return history

@router.get("/scheduler/config")
def get_scheduler_config():
    try:
        config = get_ext_sync_interval()
        return {"status": "success", "data": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/scheduler/config")
def update_scheduler_config(request: UpdateIntervalRequest):
    try:
        return update_ext_sync_interval(request.minutes, request.is_paused)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))