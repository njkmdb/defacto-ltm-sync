import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.models import EventRaw, EventFact, EventMemory
from schemas.api_schemas import CreateRawEventRequest, UpdateRawEventRequest

logger = logging.getLogger(__name__)

async def create_raw_event(request: CreateRawEventRequest, db: Session) -> dict:
    try:
        new_raw = EventRaw(base_entity_id=request.base_entity_id, event_date=request.event_date, raw_content=request.raw_content, sync_status_id=0)
        db.add(new_raw)
        db.commit()
        db.refresh(new_raw)
        return {"status": "success", "message": "수동 데이터 적재 완료", "raw_id": new_raw.raw_id, "base_entity_id": new_raw.base_entity_id}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

async def update_raw_event(raw_id: int, request: UpdateRawEventRequest, db: Session) -> dict:
    try:
        raw_record = db.query(EventRaw).filter(EventRaw.raw_id == raw_id).first()
        if raw_record.sync_status_id == 1:
            facts = db.query(EventFact).filter(EventFact.raw_id == raw_id).all()
            for f in facts:
                db.query(EventMemory).filter(EventMemory.source_event_ids.contains([f.event_id])).delete(synchronize_session=False)
                db.delete(f)

        if request.base_entity_id is not None:
            raw_record.base_entity_id = request.base_entity_id
            
        raw_record.event_date = request.event_date
        raw_record.raw_content = request.raw_content
        raw_record.sync_status_id = 0
        db.commit()
        return {"status": "success", "message": f"Raw ID {raw_id} 교정 완료", "raw_id": raw_id, "base_entity_id": raw_record.base_entity_id}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

async def delete_raw_event(raw_id: int, db: Session) -> dict:
    try:
        raw_record = db.query(EventRaw).filter(EventRaw.raw_id == raw_id).first()
        if raw_record.sync_status_id == 1:
            facts = db.query(EventFact).filter(EventFact.raw_id == raw_id).all()
            for f in facts:
                db.query(EventMemory).filter(EventMemory.source_event_ids.contains([f.event_id])).delete(synchronize_session=False)
                db.delete(f)
                
        raw_record.sync_status_id = 9
        db.commit()
        return {"status": "success", "message": f"Raw ID {raw_id} 삭제됨"}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

async def delete_bulk_raw_events(raw_ids: list[int], db: Session) -> dict:
    try:
        raw_records = db.query(EventRaw).filter(EventRaw.raw_id.in_(raw_ids)).all()
        
        synced_raw_ids = [r.raw_id for r in raw_records if r.sync_status_id == 1]
        fact_ids_to_delete = []

        if synced_raw_ids:
            facts = db.query(EventFact).filter(EventFact.raw_id.in_(synced_raw_ids)).all()
            for f in facts:
                fact_ids_to_delete.append(f.event_id)
                db.delete(f)

        for raw_record in raw_records:
            raw_record.sync_status_id = 9
        
        # 💡 [AST Depth Limit 최적화] or_ 전개 대신 EXISTS와 jsonb_array_elements를 활용한 단일 쿼리로 최적화
        if fact_ids_to_delete:
            ids_csv = ",".join(f"'{fid}'" for fid in fact_ids_to_delete)
            db.query(EventMemory).filter(
                text(f"EXISTS (SELECT 1 FROM jsonb_array_elements(source_event_ids) AS elem WHERE elem::text IN ({ids_csv}))")
            ).delete(synchronize_session=False)

        db.commit()
        return {"status": "success", "message": f"총 {len(raw_records)}건 일괄 삭제됨"}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))