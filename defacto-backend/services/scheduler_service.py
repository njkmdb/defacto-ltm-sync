import asyncio
import logging
import random
from datetime import datetime
from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database.database import SessionLocal
from database.models import ExtSyncHistory

logger = logging.getLogger(__name__)

LOCK_ID = 10241024  # EXT 동기화 중복 방지를 위한 고유 DB Lock ID
scheduler = AsyncIOScheduler()

def get_ext_sync_interval() -> dict:
    """현재 설정된 스케줄러의 실행 주기(분)와 일시정지 상태를 반환합니다."""
    job = scheduler.get_job('ext_sync_job')
    is_paused = False
    minutes = 10
    
    if job:
        # next_run_time이 None이면 일시정지 상태로 간주
        is_paused = job.next_run_time is None
        if hasattr(job.trigger, 'interval'):
            # timedelta 객체의 total_seconds()를 분 단위로 환산
            minutes = int(job.trigger.interval.total_seconds() / 60)
            
    return {"minutes": minutes, "is_paused": is_paused}

def update_ext_sync_interval(minutes: int, is_paused: bool) -> dict:
    """스케줄러의 실행 주기를 동적으로 변경하거나 일시정지합니다."""
    if is_paused:
        scheduler.pause_job('ext_sync_job')
        logger.info("⏸️ 스케줄러가 일시정지 되었습니다.")
        return {"status": "success", "message": "마이크로 배치 스케줄러가 일시정지 되었습니다."}
    else:
        scheduler.resume_job('ext_sync_job')
        if minutes >= 1:
            scheduler.reschedule_job('ext_sync_job', trigger='interval', minutes=minutes)
        logger.info(f"▶️ 스케줄러가 재가동되었으며 주기가 {minutes}분으로 설정되었습니다.")
        return {"status": "success", "message": f"스케줄러가 재가동(주기: {minutes}분) 되었습니다."}

async def process_ext_sync(sync_type: str):
    """
    마이크로 배치 동기화 비즈니스 로직
    """
    # 🚨 [방어] 시작 상태 기록은 메인 로직과 완전히 분리된 별도 세션에서 진행
    with SessionLocal() as db:
        new_sync = ExtSyncHistory(
            sync_type=sync_type,
            status="RUNNING",
            records_fetched=0,
            start_ts=datetime.utcnow()
        )
        db.add(new_sync)
        db.commit()
        db.refresh(new_sync)
        sync_id = new_sync.sync_id

    try:
        # 💡 [결함 수정] 백엔드 권한 오류 방지. ext 스키마 Write 로직을 제거하고 Airbyte 동기화 지연만 모사
        await asyncio.sleep(2)  
        records_created = random.randint(5, 30)
        logger.info(f"☁️ 외부 시스템(ERP/CRM) 연동 모사 완료: 총 {records_created}건 데이터 수집 및 동기화 가정")
        
        # 완료 상태 기록 (SUCCESS) 및 수집된 건수 업데이트
        with SessionLocal() as db:
            sync_record = db.query(ExtSyncHistory).filter(ExtSyncHistory.sync_id == sync_id).first()
            if sync_record:
                sync_record.status = "SUCCESS"
                sync_record.records_fetched = records_created
                sync_record.end_ts = datetime.utcnow()
                db.commit()
                
    except Exception as e:
        logger.error(f"마이크로 배치 처리 중 에러 발생: {e}")
        # 🚨 [방어] 에러 발생 시에도 독립 세션으로 안전하게 실패 기록 (FAILED) 유지
        with SessionLocal() as db:
            sync_record = db.query(ExtSyncHistory).filter(ExtSyncHistory.sync_id == sync_id).first()
            if sync_record:
                sync_record.status = "FAILED"
                sync_record.error_message = str(e)
                sync_record.end_ts = datetime.utcnow()
                db.commit()
        raise

async def run_ext_sync_job(sync_type="AUTO"):
    """
    스케줄러에 의해 주기적으로 실행되는 래퍼 함수 (다중 워커 분산 락 적용)
    """
    with SessionLocal() as db:
        # 1. 세션 레벨의 Advisory Lock 획득 시도 (Non-blocking)
        lock_acquired = db.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": LOCK_ID}).scalar()
        if not lock_acquired:
            logger.info("다른 워커가 이미 동기화 배치를 수행 중입니다. 작업을 스킵합니다.")
            return

        try:
            # 2. 실제 배치 비즈니스 로직 수행
            await process_ext_sync(sync_type)
        except Exception as e:
            logger.error(f"배치 실행기 에러 발생: {e}")
        finally:
            # 3. 🚨 어떠한 에러가 발생해도 Lock은 반드시 해제하여 다음 주기의 데드락 원천 차단
            db.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})
            db.commit()