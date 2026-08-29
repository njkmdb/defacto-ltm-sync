import logging
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import text
from database.models import EventRaw, EventFact, EventMemory, EventBriefing, EventCreation
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

def _disconnect_memories_from_creations(mem_ids: list[int], db: Session):
    if not mem_ids: return
    mem_ids_str_set = {str(m) for m in mem_ids}
    mem_ids_csv = ",".join(f"'{m}'" for m in mem_ids)
    
    briefings_to_update = db.query(EventBriefing).filter(
        text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_memory_ids) AS elem WHERE elem IN ({mem_ids_csv}))")
    ).all()
    for b in briefings_to_update:
        b.source_memory_ids = [mid for mid in (b.source_memory_ids or []) if str(mid) not in mem_ids_str_set]
        flag_modified(b, "source_memory_ids")

async def update_raw_event(raw_id: int, request: UpdateRawEventRequest, db: Session) -> dict:
    try:
        raw_record = db.query(EventRaw).filter(EventRaw.raw_id == raw_id, EventRaw.base_entity_id == request.base_entity_id).first()
        if not raw_record:
            raise Exception(f"Raw ID {raw_id} 데이터를 찾을 수 없거나 접근 권한이 없습니다.")

        if raw_record.sync_status_id == 1:
            facts = db.query(EventFact).filter(EventFact.raw_id == raw_id).all()
            if facts:
                fact_ids = [str(f.event_id) for f in facts]
                fact_ids_csv = ",".join(f"'{fid}'" for fid in fact_ids)

                memories = db.query(EventMemory).filter(
                    text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_event_ids) AS elem WHERE elem IN ({fact_ids_csv}))")
                ).all()

                mem_ids = [m.memory_id for m in memories]
                _disconnect_memories_from_creations(mem_ids, db)

                for m in memories: db.delete(m)
                for f in facts: db.delete(f)

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

def analyze_raw_event_impact(raw_id: int, base_entity_id: int, db: Session) -> dict:
    impacted_items = []
    raw = db.query(EventRaw).filter(EventRaw.raw_id == raw_id, EventRaw.base_entity_id == base_entity_id).first()
    if not raw: return {"status": "success", "affected_count": 0, "affected_items": []}

    facts = db.query(EventFact.event_id).filter(EventFact.raw_id == raw_id).all()
    if not facts: return {"status": "success", "affected_count": 0, "affected_items": []}
    
    fact_ids = [str(f[0]) for f in facts]
    fact_ids_csv = ",".join(f"'{fid}'" for fid in fact_ids)
    
    memories = db.query(EventMemory.memory_id).filter(
        text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_event_ids) AS elem WHERE elem IN ({fact_ids_csv}))")
    ).all()
    
    if memories:
        mem_ids = [str(m[0]) for m in memories]
        mem_ids_csv = ",".join(f"'{mid}'" for mid in mem_ids)
        
        briefings = db.query(EventBriefing).filter(
            text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_memory_ids) AS elem WHERE elem IN ({mem_ids_csv}))")
        ).all()
        for b in briefings:
            impacted_items.append({"item_type": "BRIEFING", "item_id": b.briefing_id, "title_or_summary": b.query_text})
            
        if briefings:
            b_ids = [str(b.briefing_id) for b in briefings]
            b_ids_csv = ",".join(f"'{bid}'" for bid in b_ids)
            creations = db.query(EventCreation).filter(
                text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_briefing_ids) AS elem WHERE elem IN ({b_ids_csv}))")
            ).all()
            for c in creations:
                impacted_items.append({"item_type": "CREATION", "item_id": c.creation_id, "title_or_summary": c.creative_title})
                
    return {"status": "success", "affected_count": len(impacted_items), "affected_items": impacted_items}

async def delete_raw_event(raw_id: int, base_entity_id: int, cascade_mode: str, db: Session) -> dict:
    try:
        raw_record = db.query(EventRaw).filter(EventRaw.raw_id == raw_id, EventRaw.base_entity_id == base_entity_id).first()
        if not raw_record: raise Exception("대상을 찾을 수 없거나 접근 권한이 없습니다.")

        if raw_record.sync_status_id == 1:
            facts = db.query(EventFact).filter(EventFact.raw_id == raw_id).all()
            if facts:
                fact_ids = [str(f.event_id) for f in facts]
                fact_ids_csv = ",".join(f"'{fid}'" for fid in fact_ids)
                
                memories = db.query(EventMemory).filter(
                    text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_event_ids) AS elem WHERE elem IN ({fact_ids_csv}))")
                ).all()
                mem_ids = [m.memory_id for m in memories]

                if cascade_mode == "SOFT_DISCONNECT" and mem_ids:
                    _disconnect_memories_from_creations(mem_ids, db) 
            
                for m in memories: db.delete(m)
                for f in facts: db.delete(f)
                
        raw_record.sync_status_id = 9
        db.commit()
        return {"status": "success", "message": f"Raw ID {raw_id} 삭제 및 {cascade_mode} 처리 완료"}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

async def delete_bulk_raw_events(raw_ids: list[int], base_entity_id: int, db: Session) -> dict:
    try:
        raw_records = db.query(EventRaw).filter(EventRaw.raw_id.in_(raw_ids), EventRaw.base_entity_id == base_entity_id).all()
        synced_raw_ids = [r.raw_id for r in raw_records if r.sync_status_id == 1]
        fact_ids_to_delete = []

        if synced_raw_ids:
            facts = db.query(EventFact).filter(EventFact.raw_id.in_(synced_raw_ids)).all()
            for f in facts:
                fact_ids_to_delete.append(str(f.event_id))
                db.delete(f)

        for raw_record in raw_records:
            raw_record.sync_status_id = 9
        
        if fact_ids_to_delete:
            ids_csv = ",".join(f"'{fid}'" for fid in fact_ids_to_delete)
            
            memories_to_delete = db.query(EventMemory).filter(
                text(f"EXISTS (SELECT 1 FROM jsonb_array_elements_text(source_event_ids) AS elem WHERE elem IN ({ids_csv}))")
            ).all()
            mem_ids = [m.memory_id for m in memories_to_delete]
            
            _disconnect_memories_from_creations(mem_ids, db) 
            for m in memories_to_delete: db.delete(m)

        db.commit()
        return {"status": "success", "message": f"총 {len(raw_records)}건 일괄 삭제됨"}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def get_raw_event_status(raw_id: int, base_entity_id: int, db: Session) -> dict:
    raw_record = db.query(EventRaw.raw_id, EventRaw.sync_status_id, EventRaw.error_log).filter(EventRaw.raw_id == raw_id, EventRaw.base_entity_id == base_entity_id).first()
    if not raw_record:
        raise Exception("해당 원본 데이터를 찾을 수 없거나 접근 권한이 없습니다.")
    return {
        "raw_id": raw_record.raw_id,
        "sync_status_id": raw_record.sync_status_id or 0,
        "error_log": raw_record.error_log
    }