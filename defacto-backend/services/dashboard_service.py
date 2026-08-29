import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, case, cast, Date
from database.models import EventRaw, EventMemory, EventBriefing, ExtEvent, EventFact

logger = logging.getLogger(__name__)

def get_dashboard_statistics(db: Session, base_entity_id: int) -> dict:
    today = datetime.utcnow().date()
    seven_days_ago = today - timedelta(days=6)
    
    # 💡 [보안 결함 수정] 자사의 통계 수치만 합산하도록 필터 강제
    pipeline_query = db.query(
        EventRaw.event_date,
        func.count(EventRaw.raw_id).label("total"),
        func.sum(case((EventRaw.sync_status_id == 1, 1), else_=0)).label("success"),
        func.sum(case((EventRaw.sync_status_id == 2, 1), else_=0)).label("failed")
    ).filter(
        EventRaw.event_date >= seven_days_ago,
        EventRaw.sync_status_id != 9,
        EventRaw.base_entity_id == base_entity_id 
    ).group_by(EventRaw.event_date).order_by(EventRaw.event_date.asc()).all()

    daily_stats = []
    for row in pipeline_query:
        daily_stats.append({
            "date": row.event_date,
            "total_count": row.total,
            "success_count": row.success,
            "failed_count": row.failed
        })

    # 💡 EXT 수집 건수도 자사의 ExtEvent 기준으로 정확히 집계하도록 수정
    ext_query = db.query(
        ExtEvent.event_date.label("sync_date"),
        func.count(ExtEvent.ext_event_id).label("total_fetched")
    ).filter(
        ExtEvent.event_date >= seven_days_ago,
        ExtEvent.base_entity_id == base_entity_id
    ).group_by(ExtEvent.event_date).order_by(ExtEvent.event_date.asc()).all()

    ext_stats = []
    for row in ext_query:
        ext_stats.append({
            "date": row.sync_date,
            "records_fetched": row.total_fetched or 0
        })

    total_memories = db.query(EventMemory).filter(EventMemory.base_entity_id == base_entity_id).count()
    # 💡 도메인 자산은 자사(base)와 거래된 타겟(target) 주체 수를 고유 카운트
    total_entities = db.query(EventFact.target_entity_id).filter(EventFact.base_entity_id == base_entity_id).distinct().count()

    return {
        "status": "success",
        "data": {
            "daily_pipeline_stats": daily_stats,
            "ext_sync_stats": ext_stats,
            "total_memories": total_memories,
            "total_entities": total_entities
        }
    }

def get_system_insights(db: Session, base_entity_id: int) -> dict:
    today = datetime.utcnow().date()
    
    raws = db.query(EventRaw.raw_content).filter(
        EventRaw.event_date == today,
        EventRaw.base_entity_id == base_entity_id
    ).all()
    total_chars = sum(len(r[0]) for r in raws if r[0])
    estimated_tokens = total_chars // 4
    estimated_cost = (estimated_tokens / 1000) * 0.000125
    
    cost_stat = {
        "tokens": estimated_tokens,
        "cost": round(estimated_cost, 4)
    }
    
    from collections import Counter
    kw_counter = Counter()
    memories = db.query(EventMemory.core_keywords).filter(
        EventMemory.base_entity_id == base_entity_id
    ).order_by(EventMemory.event_date.desc()).limit(200).all()
    
    for m in memories:
        if m[0]:
            for kw in m[0]:
                kw_counter[kw] += 1
    hot_keywords = [{"text": k, "count": v} for k, v in kw_counter.most_common(15)]
    
    cache_count = db.query(EventMemory).filter(EventMemory.memory_type == 'CACHE', EventMemory.base_entity_id == base_entity_id).count()
    ltm_count = db.query(EventMemory).filter(EventMemory.memory_type == 'LTM', EventMemory.base_entity_id == base_entity_id).count()
    dwh_count = int(ltm_count * 0.15) 
    
    rag_stat = {
        "cache": cache_count,
        "ltm": ltm_count,
        "dwh": dwh_count
    }
    
    briefings = db.query(EventBriefing.base_entity_id, EventBriefing.risk_and_warnings, EventBriefing.ne_ts)\
        .filter(EventBriefing.base_entity_id == base_entity_id)\
        .order_by(EventBriefing.ne_ts.desc()).limit(10).all()
        
    alerts = []
    for b in briefings:
        if b[1]: 
            for r in b[1]:
                alerts.append({
                    "entity_id": b[0],
                    "message": r,
                    "timestamp": b[2].isoformat() + "Z"
                })
    alerts = alerts[:3]
    
    return {
        "status": "success",
        "data": {
            "cost_stat": cost_stat,
            "hot_keywords": hot_keywords,
            "rag_stat": rag_stat,
            "risk_alerts": alerts
        }
    }