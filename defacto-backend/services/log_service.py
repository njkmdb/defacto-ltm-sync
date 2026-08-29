import json
import math
import logging
from datetime import datetime 
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, and_, or_, func, text
from sqlalchemy.dialects.postgresql import insert 
from database.models import EventLog, EventCreation
from schemas.api_schemas import SaveSummaryRequest, BulkUpsertLogRequest

logger = logging.getLogger(__name__)

def get_event_logs(db: Session, page: int = 1, limit: int = 20, start_date: str = None, end_date: str = None, search_conditions: str = None) -> dict:
    query = db.query(EventLog)
    if start_date:
        try: query = query.filter(EventLog.log_date >= datetime.strptime(start_date, "%Y-%m-%d").date())
        except ValueError: pass
    if end_date:
        try: query = query.filter(EventLog.log_date <= datetime.strptime(end_date, "%Y-%m-%d").date())
        except ValueError: pass
    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                def build_cond(target, kw):
                    kw = kw.strip()
                    if target == 'LOG_ID' and kw.isdigit(): return EventLog.log_id == int(kw)
                    elif target == 'ENTITY_ID' and kw.isdigit(): return EventLog.base_entity_id == int(kw)
                    elif target == 'SUMMARY': return EventLog.llm_summary.ilike(f"%{kw}%")
                    elif target == 'ACTION_ITEMS': return cast(EventLog.action_items, String).ilike(f"%{kw}%")
                    return None
                combined_expr = None
                for c in conds:
                    kw = c.get('keyword', '')
                    if not kw.strip(): continue
                    expr = build_cond(c.get('target'), kw)
                    if expr is not None:
                        if combined_expr is None: combined_expr = expr
                        else:
                            op = c.get('operator', 'AND')
                            if op == 'OR': combined_expr = or_(combined_expr, expr)
                            else: combined_expr = and_(combined_expr, expr)
                if combined_expr is not None: query = query.filter(combined_expr)
        except Exception as e:
            logger.error(f"다중 검색 파싱 오류: {e}")
            pass
    total_count = query.count()
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    offset = (page - 1) * limit
    logs = query.order_by(EventLog.log_date.desc()).offset(offset).limit(limit).all()
    result_list = []
    for log in logs:
        action_items = log.action_items if log.action_items else []
        if isinstance(action_items, str):
            try: action_items = json.loads(action_items)
            except: action_items = []
        result_list.append({"log_id": log.log_id, "base_entity_id": log.base_entity_id, "log_date": log.log_date, "llm_summary": log.llm_summary, "action_items": action_items})
    return {"status": "success", "data": result_list, "meta": { "total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit }}

def delete_event_log(log_id: int, base_entity_id: int, db: Session) -> dict:
    try:
        log_record = db.query(EventLog).filter(EventLog.log_id == log_id, EventLog.base_entity_id == base_entity_id).first()
        if not log_record: return {"status": "error", "message": f"일지 ID {log_id} 미발견 또는 권한 없음"}
        linked_creations = db.query(EventCreation).filter(EventCreation.source_log_ids.contains([log_id])).all()
        for c in linked_creations: c.source_log_ids = [lid for lid in c.source_log_ids if lid != log_id]
        db.delete(log_record)
        db.commit()
        return {"status": "success", "message": f"선택한 일지가 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_bulk_event_logs(log_ids: list[int], base_entity_id: int, db: Session) -> dict:
    try:
        logs_to_delete = db.query(EventLog).filter(EventLog.log_id.in_(log_ids), EventLog.base_entity_id == base_entity_id).all()
        valid_log_ids = [l.log_id for l in logs_to_delete]
        if not valid_log_ids: return {"status": "success", "message": "삭제할 일지가 없거나 권한이 없습니다."}
        ids_csv = ",".join(f"'{lid}'" for lid in valid_log_ids)
        linked_creations = db.query(EventCreation).filter(text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_log_ids) AS elem WHERE elem IN ({ids_csv}))")).all()
        for c in linked_creations: c.source_log_ids = [lid for lid in c.source_log_ids if lid not in valid_log_ids]
        db.query(EventLog).filter(EventLog.log_id.in_(valid_log_ids)).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "message": f"총 {len(valid_log_ids)}건의 일지가 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def save_edited_summary(request: SaveSummaryRequest, db: Session) -> dict:
    try:
        action_items_list = [item.model_dump() if hasattr(item, 'model_dump') else item.dict() for item in request.action_items]
        if request.log_id:
            existing = db.query(EventLog).filter(EventLog.log_id == request.log_id, EventLog.base_entity_id == request.base_entity_id).first()
            if not existing: raise Exception("해당 일지를 찾을 수 없거나 권한이 없습니다.")
            existing.log_date = request.reference_date
            existing.llm_summary = request.edited_summary
            existing.action_items = action_items_list
            existing.up_ts = datetime.utcnow()
        else:
            existing = db.query(EventLog).filter(EventLog.base_entity_id == request.base_entity_id, EventLog.log_date == request.reference_date).first()
            if existing:
                existing.llm_summary = request.edited_summary
                existing.action_items = action_items_list
                existing.up_ts = datetime.utcnow()
            else:
                new_log = EventLog(
                    base_entity_id=request.base_entity_id,
                    log_date=request.reference_date,
                    schema_name=request.schema_name,
                    llm_summary=request.edited_summary,
                    action_items=action_items_list
                )
                db.add(new_log)
        db.commit()
        return {"status": "success", "message": f"성공적으로 처리(저장/업데이트) 되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"일지 저장 중 오류 발생: {str(e)}")

def bulk_upsert_event_logs(request: BulkUpsertLogRequest, db: Session) -> dict:
    try:
        if not request.items: return {"status": "success", "message": "처리할 데이터가 없습니다."}
        for item in request.items:
            action_items_json = [ai.model_dump() if hasattr(ai, 'model_dump') else ai.dict() for ai in item.action_items]
            if item.log_id is not None:
                stmt = insert(EventLog).values(
                    log_id=item.log_id, base_entity_id=item.base_entity_id,
                    log_date=item.log_date, schema_name="LTM_Synthesis",
                    llm_summary=item.llm_summary, action_items=action_items_json,
                    up_ts=datetime.utcnow()
                )
                update_dict = {
                    "log_date": stmt.excluded.log_date,
                    "llm_summary": stmt.excluded.llm_summary,
                    "action_items": stmt.excluded.action_items,
                    "up_ts": datetime.utcnow()
                }
                stmt = stmt.on_conflict_do_update(index_elements=['log_id'], set_=update_dict)
                db.execute(stmt)
            else:
                new_log = EventLog(
                    base_entity_id=item.base_entity_id,
                    log_date=item.log_date,
                    schema_name="LTM_Synthesis",
                    llm_summary=item.llm_summary,
                    action_items=action_items_json
                )
                db.add(new_log)
        db.execute(text("SELECT setval('core.event_logs_log_id_seq', COALESCE((SELECT MAX(log_id) FROM core.event_logs), 1), true)"))
        db.commit()
        return {"status": "success", "message": f"총 {len(request.items)}건의 일지가 성공적으로 일괄 반영(Upsert) 되었습니다."}
    except Exception as e:
        db.rollback(); raise Exception(str(e))

def get_event_log(log_id: int, base_entity_id: int, db: Session) -> dict:
    log = db.query(EventLog).filter(EventLog.log_id == log_id, EventLog.base_entity_id == base_entity_id).first()
    if not log: raise Exception("해당 일지를 찾을 수 없거나 접근 권한이 없습니다.")
    action_items = log.action_items if log.action_items else []
    if isinstance(action_items, str):
        try: action_items = json.loads(action_items)
        except: action_items = []
    return {"status": "success", "data": {"log_id": log.log_id, "base_entity_id": log.base_entity_id, "log_date": log.log_date, "llm_summary": log.llm_summary, "action_items": action_items}}