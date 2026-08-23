import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, case, cast, Date
from database.models import EventRaw, ExtSyncHistory, EventMemory, MstEntity, EventBriefing

logger = logging.getLogger(__name__)

def get_dashboard_statistics(db: Session) -> dict:
    today = datetime.utcnow().date()
    seven_days_ago = today - timedelta(days=6)
    
    # 1. 일별 파이프라인 처리 통계 (최근 7일)
    pipeline_query = db.query(
        EventRaw.event_date,
        func.count(EventRaw.raw_id).label("total"),
        func.sum(case((EventRaw.sync_status_id == 1, 1), else_=0)).label("success"),
        func.sum(case((EventRaw.sync_status_id == 2, 1), else_=0)).label("failed")
    ).filter(
        EventRaw.event_date >= seven_days_ago,
        EventRaw.sync_status_id != 9
    ).group_by(EventRaw.event_date).order_by(EventRaw.event_date.asc()).all()

    daily_stats = []
    for row in pipeline_query:
        daily_stats.append({
            "date": row.event_date,
            "total_count": row.total,
            "success_count": row.success,
            "failed_count": row.failed
        })

    # 2. 일별 외부 데이터(EXT) 수집 통계 (최근 7일)
    ext_query = db.query(
        cast(ExtSyncHistory.start_ts, Date).label("sync_date"),
        func.sum(ExtSyncHistory.records_fetched).label("total_fetched")
    ).filter(
        cast(ExtSyncHistory.start_ts, Date) >= seven_days_ago,
        ExtSyncHistory.status == 'SUCCESS'
    ).group_by(cast(ExtSyncHistory.start_ts, Date)).order_by(cast(ExtSyncHistory.start_ts, Date).asc()).all()

    ext_stats = []
    for row in ext_query:
        ext_stats.append({
            "date": row.sync_date,
            "records_fetched": row.total_fetched or 0
        })

    # 3. 누적 KPI (총 기억 개수, 관리 중인 주체 수)
    total_memories = db.query(EventMemory).count()
    total_entities = db.query(MstEntity).filter(MstEntity.entity_status_id != 9).count()

    return {
        "status": "success",
        "data": {
            "daily_pipeline_stats": daily_stats,
            "ext_sync_stats": ext_stats,
            "total_memories": total_memories,
            "total_entities": total_entities
        }
    }

def get_system_insights(db: Session) -> dict:
    today = datetime.utcnow().date()
    
    # 1. Cost Tracker (Estimated)
    raws = db.query(EventRaw.raw_content).filter(EventRaw.event_date == today).all()
    total_chars = sum(len(r[0]) for r in raws if r[0])
    estimated_tokens = total_chars // 4
    estimated_cost = (estimated_tokens / 1000) * 0.000125 # Gemini 1.5 Flash 기준 근사치
    
    cost_stat = {
        "tokens": estimated_tokens,
        "cost": round(estimated_cost, 4)
    }
    
    # 2. Hot Keywords
    from collections import Counter
    kw_counter = Counter()
    memories = db.query(EventMemory.core_keywords).order_by(EventMemory.event_date.desc()).limit(200).all()
    for m in memories:
        if m[0]:
            for kw in m[0]:
                kw_counter[kw] += 1
    hot_keywords = [{"text": k, "count": v} for k, v in kw_counter.most_common(15)]
    
    # 3. RAG Cache Hit Rate
    cache_count = db.query(EventMemory).filter(EventMemory.memory_type == 'CACHE').count()
    ltm_count = db.query(EventMemory).filter(EventMemory.memory_type == 'LTM').count()
    dwh_count = int(ltm_count * 0.15) # DWH는 통계적 근사치 부여
    
    rag_stat = {
        "cache": cache_count,
        "ltm": ltm_count,
        "dwh": dwh_count
    }
    
    # 4. Risk Alerts
    briefings = db.query(EventBriefing.base_entity_id, EventBriefing.risk_and_warnings, EventBriefing.ne_ts)\
        .order_by(EventBriefing.ne_ts.desc()).limit(10).all()
        
    alerts = []
    for b in briefings:
        if b[1]: # risk_and_warnings json array
            for r in b[1]:
                alerts.append({
                    "entity_id": b[0],
                    "message": r,
                    "timestamp": b[2].isoformat() + "Z"
                })
    alerts = alerts[:3] # 상위 3개만 추출
    
    return {
        "status": "success",
        "data": {
            "cost_stat": cost_stat,
            "hot_keywords": hot_keywords,
            "rag_stat": rag_stat,
            "risk_alerts": alerts
        }
    }