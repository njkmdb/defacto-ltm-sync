import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.database import get_db
from database.models import EventRaw, BatchJob, ExtSyncHistory
from schemas.api_schemas import (
    BulkSynthesizeRequest, BulkSynthesizeResponse,
    BatchJobStatusResponse, ForceSyncResponse, ExtSyncHistoryItem,
    UpdateIntervalRequest
)
from services.batch_service import bulk_synthesize_task
from services.scheduler_service import run_ext_sync_job, get_ext_sync_interval, update_ext_sync_interval

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Scheduler & Batch"])

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

@router.post("/bulk-synthesize", response_model=BulkSynthesizeResponse, status_code=202)
async def trigger_bulk_synthesize(request: BulkSynthesizeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), target_lang: str = Depends(get_target_language)):
    try:
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
            background_tasks.add_task(bulk_synthesize_task, job_id, request.reference_date, entity_ids, request.pipeline_id, target_lang)
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
    # 💡 [버그 수정] Pydantic 리스트 직렬화 에러를 피하기 위해 명시적으로 dict 매핑
    return [
        {
            "sync_id": h.sync_id,
            "sync_type": h.sync_type,
            "status": h.status,
            "records_fetched": h.records_fetched,
            "error_message": h.error_message,
            "start_ts": h.start_ts,
            "end_ts": h.end_ts,
            "up_ts": h.up_ts,
            "ne_ts": h.ne_ts
        } for h in history
    ]

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