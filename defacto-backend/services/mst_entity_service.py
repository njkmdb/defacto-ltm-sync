import json
import math
import logging
from datetime import datetime 
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, and_, or_, text
from sqlalchemy.dialects.postgresql import insert 
from sqlalchemy.exc import IntegrityError 
from database.models import MstEntity
from schemas.api_schemas import (
    CreateMstEntityRequest, UpdateMstEntityRequest, BulkUpsertMstEntityRequest
)

logger = logging.getLogger(__name__)

def get_lang_code(target_lang: str) -> str:
    lang_map = {"Japanese": "ja", "English": "en", "Korean": "ko"}
    return lang_map.get(target_lang, "ko")

def get_mst_entity_types(db: Session) -> dict:
    types = db.query(MstEntity.entity_type).filter(MstEntity.entity_status_id != 9, MstEntity.entity_id != 0).distinct().all()
    return {"status": "success", "data": [t[0] for t in types if t[0]]}

def get_mst_entities(db: Session, page: int = 1, limit: int = 20, type_filter: str = None, search_conditions: str = None, target_lang: str = "Korean") -> dict:
    query = db.query(MstEntity).filter(MstEntity.entity_status_id != 9, MstEntity.entity_id != 0)
    if type_filter and type_filter != 'ALL': query = query.filter(MstEntity.entity_type == type_filter)
    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                def build_cond(target, kw):
                    kw = kw.strip()
                    if target == 'ID' and kw.isdigit(): return MstEntity.entity_id == int(kw)
                    elif target == 'TYPE': return MstEntity.entity_type.ilike(f"%{kw}%")
                    elif target == 'NAME': return MstEntity.entity_name.ilike(f"%{kw}%")
                    elif target == 'PARENT' and kw.isdigit(): return MstEntity.parent_entity_id == int(kw)
                    elif target == 'ATTRIBUTES': return cast(MstEntity.attributes, String).ilike(f"%{kw}%")
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
        except Exception as e: logger.error(f"다중 검색 파싱 오류 (Entity): {e}")
        
    total_count = query.count()
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    offset = (page - 1) * limit
    entities = query.order_by(MstEntity.entity_id.desc()).offset(offset).limit(limit).all()
    
    lang_code = get_lang_code(target_lang)
    data = []
    for e in entities:
        final_name = e.entity_name
        if e.attributes and f"name_{lang_code}" in e.attributes:
            final_name = e.attributes[f"name_{lang_code}"]
            
        data.append({
            "entity_id": e.entity_id, 
            "parent_entity_id": e.parent_entity_id, 
            "entity_type": e.entity_type, 
            "entity_name": final_name, 
            "attributes": e.attributes or {}, 
            "entity_status_id": e.entity_status_id, 
            "ne_ts": e.ne_ts, 
            "up_ts": e.up_ts
        })
        
    return {"status": "success", "data": data, "meta": { "total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit }}

def create_mst_entity(request: CreateMstEntityRequest, db: Session) -> dict:
    try:
        if request.entity_id is not None:
            existing = db.query(MstEntity).filter(MstEntity.entity_id == request.entity_id).first()
            if existing: raise Exception(f"이미 사용 중인 주체 ID ({request.entity_id}) 입니다.")
        kwargs = { "parent_entity_id": request.parent_entity_id, "entity_type": request.entity_type, "entity_name": request.entity_name, "attributes": request.attributes, "entity_status_id": request.entity_status_id or 1 }
        if request.entity_id is not None: kwargs["entity_id"] = request.entity_id
        new_entity = MstEntity(**kwargs)
        db.add(new_entity)
        db.commit()
        return {"status": "success", "message": "신규 주체 마스터가 등록되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def update_mst_entity(entity_id: int, request: UpdateMstEntityRequest, db: Session) -> dict:
    try:
        entity = db.query(MstEntity).filter(MstEntity.entity_id == entity_id).first()
        if not entity: raise Exception("대상을 찾을 수 없습니다.")
        if request.entity_id is not None and request.entity_id != entity_id:
            existing = db.query(MstEntity).filter(MstEntity.entity_id == request.entity_id).first()
            if existing: raise Exception(f"이미 사용 중인 주체 ID ({request.entity_id}) 입니다.")
            entity.entity_id = request.entity_id
        entity.parent_entity_id = request.parent_entity_id
        entity.entity_type = request.entity_type
        entity.entity_name = request.entity_name
        entity.attributes = request.attributes
        if request.entity_status_id is not None: entity.entity_status_id = request.entity_status_id
        db.commit()
        return {"status": "success", "message": "주체 데이터가 수정되었습니다."}
    except IntegrityError:
        db.rollback()
        raise Exception("해당 마스터 ID는 참조 중이므로 변경할 수 없습니다.")
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_mst_entity(entity_id: int, db: Session) -> dict:
    try:
        entity = db.query(MstEntity).filter(MstEntity.entity_id == entity_id).first()
        if not entity: return {"status": "error", "message": "대상을 찾을 수 없습니다."}
        entity.entity_status_id = 9 
        db.commit()
        return {"status": "success", "message": "주체 데이터가 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_bulk_mst_entities(entity_ids: list[int], db: Session) -> dict:
    try:
        entities = db.query(MstEntity).filter(MstEntity.entity_id.in_(entity_ids)).all()
        for e in entities: e.entity_status_id = 9
        db.commit()
        return {"status": "success", "message": f"총 {len(entities)}건의 주체 데이터가 일괄 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def bulk_upsert_mst_entities(request: BulkUpsertMstEntityRequest, db: Session) -> dict:
    try:
        if not request.items: return {"status": "success", "message": "처리할 데이터가 없습니다."}
        for item in request.items:
            if item.entity_id is not None:
                stmt = insert(MstEntity).values(
                    entity_id=item.entity_id, parent_entity_id=item.parent_entity_id,
                    entity_type=item.entity_type, entity_name=item.entity_name, attributes=item.attributes, 
                    entity_status_id=item.entity_status_id or 1, up_ts=datetime.utcnow()
                )
                update_dict = { "entity_type": stmt.excluded.entity_type, "entity_name": stmt.excluded.entity_name, "parent_entity_id": stmt.excluded.parent_entity_id, "attributes": stmt.excluded.attributes, "entity_status_id": stmt.excluded.entity_status_id, "up_ts": datetime.utcnow() }
                stmt = stmt.on_conflict_do_update(index_elements=['entity_id'], set_=update_dict)
                db.execute(stmt)
            else:
                new_entity = MstEntity(parent_entity_id=item.parent_entity_id, entity_type=item.entity_type, entity_name=item.entity_name, attributes=item.attributes, entity_status_id=item.entity_status_id or 1)
                db.add(new_entity)
                
        db.execute(text("SELECT setval('domain.mst_entities_entity_id_seq', COALESCE((SELECT MAX(entity_id) FROM domain.mst_entities), 1), true)"))
        db.commit()
        return {"status": "success", "message": f"총 {len(request.items)}건의 주체 데이터가 성공적으로 일괄 반영(Upsert) 되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))