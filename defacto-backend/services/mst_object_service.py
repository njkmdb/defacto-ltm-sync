import json
import math
import logging
from datetime import datetime 
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, and_, or_, text
from sqlalchemy.dialects.postgresql import insert 
from sqlalchemy.exc import IntegrityError 
from database.models import MstObject
from schemas.api_schemas import (
    CreateMstObjectRequest, UpdateMstObjectRequest, BulkUpsertMstObjectRequest
)

logger = logging.getLogger(__name__)

def get_mst_object_types(db: Session) -> dict:
    types = db.query(MstObject.object_type).filter(MstObject.object_status_id != 9, MstObject.object_id != 0).distinct().all()
    return {"status": "success", "data": [t[0] for t in types if t[0]]}

def get_mst_objects(db: Session, page: int = 1, limit: int = 20, type_filter: str = None, search_conditions: str = None) -> dict:
    query = db.query(MstObject).filter(MstObject.object_status_id != 9, MstObject.object_id != 0)
    if type_filter and type_filter != 'ALL': query = query.filter(MstObject.object_type == type_filter)
    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                def build_cond(target, kw):
                    kw = kw.strip()
                    if target == 'ID' and kw.isdigit(): return MstObject.object_id == int(kw)
                    elif target == 'TYPE': return MstObject.object_type.ilike(f"%{kw}%")
                    elif target == 'NAME': return MstObject.object_name.ilike(f"%{kw}%")
                    elif target == 'PARENT' and kw.isdigit(): return MstObject.parent_object_id == int(kw)
                    elif target == 'ATTRIBUTES': return cast(MstObject.attributes, String).ilike(f"%{kw}%")
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
        except Exception as e: logger.error(f"다중 검색 파싱 오류 (Object): {e}")
        
    total_count = query.count()
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    offset = (page - 1) * limit
    objects = query.order_by(MstObject.object_id.desc()).offset(offset).limit(limit).all()
    data = [{"object_id": o.object_id, "parent_object_id": o.parent_object_id, "object_type": o.object_type, "object_name": o.object_name, "attributes": o.attributes or {}, "object_status_id": o.object_status_id, "ne_ts": o.ne_ts, "up_ts": o.up_ts} for o in objects]
    return {"status": "success", "data": data, "meta": { "total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit }}

def create_mst_object(request: CreateMstObjectRequest, db: Session) -> dict:
    try:
        if request.object_id is not None:
            existing = db.query(MstObject).filter(MstObject.object_id == request.object_id).first()
            if existing: raise Exception(f"이미 사용 중인 객체 ID ({request.object_id}) 입니다.")
        kwargs = { "parent_object_id": request.parent_object_id, "object_type": request.object_type, "object_name": request.object_name, "attributes": request.attributes, "object_status_id": request.object_status_id or 1 }
        if request.object_id is not None: kwargs["object_id"] = request.object_id
        new_obj = MstObject(**kwargs)
        db.add(new_obj)
        db.commit()
        return {"status": "success", "message": "신규 객체 마스터가 등록되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def update_mst_object(object_id: int, request: UpdateMstObjectRequest, db: Session) -> dict:
    try:
        obj = db.query(MstObject).filter(MstObject.object_id == object_id).first()
        if not obj: raise Exception("대상을 찾을 수 없습니다.")
        if request.object_id is not None and request.object_id != object_id:
            existing = db.query(MstObject).filter(MstObject.object_id == request.object_id).first()
            if existing: raise Exception(f"이미 사용 중인 객체 ID ({request.object_id}) 입니다.")
            obj.object_id = request.object_id
        obj.parent_object_id = request.parent_object_id
        obj.object_type = request.object_type
        obj.object_name = request.object_name
        obj.attributes = request.attributes
        if request.object_status_id is not None: obj.object_status_id = request.object_status_id
        db.commit()
        return {"status": "success", "message": "객체 데이터가 수정되었습니다."}
    except IntegrityError:
        db.rollback()
        raise Exception("해당 마스터 ID는 참조 중이므로 변경할 수 없습니다.")
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_mst_object(object_id: int, db: Session) -> dict:
    try:
        obj = db.query(MstObject).filter(MstObject.object_id == object_id).first()
        if not obj: return {"status": "error", "message": "대상을 찾을 수 없습니다."}
        obj.object_status_id = 9 
        db.commit()
        return {"status": "success", "message": "객체 데이터가 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_bulk_mst_objects(object_ids: list[int], db: Session) -> dict:
    try:
        objects = db.query(MstObject).filter(MstObject.object_id.in_(object_ids)).all()
        for o in objects: o.object_status_id = 9
        db.commit()
        return {"status": "success", "message": f"총 {len(objects)}건의 객체 데이터가 일괄 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def bulk_upsert_mst_objects(request: BulkUpsertMstObjectRequest, db: Session) -> dict:
    try:
        if not request.items: return {"status": "success", "message": "처리할 데이터가 없습니다."}
        for item in request.items:
            if item.object_id is not None:
                stmt = insert(MstObject).values(
                    object_id=item.object_id, parent_object_id=item.parent_object_id,
                    object_type=item.object_type, object_name=item.object_name,
                    attributes=item.attributes, object_status_id=item.object_status_id or 1, up_ts=datetime.utcnow()
                )
                update_dict = { "object_type": stmt.excluded.object_type, "object_name": stmt.excluded.object_name, "parent_object_id": stmt.excluded.parent_object_id, "attributes": stmt.excluded.attributes, "object_status_id": stmt.excluded.object_status_id, "up_ts": datetime.utcnow() }
                stmt = stmt.on_conflict_do_update(index_elements=['object_id'], set_=update_dict)
                db.execute(stmt)
            else:
                new_obj = MstObject(parent_object_id=item.parent_object_id, object_type=item.object_type, object_name=item.object_name, attributes=item.attributes, object_status_id=item.object_status_id or 1)
                db.add(new_obj)
                
        # 💡 [치명적 결함 방어] 명시적 PK 삽입 이후 PostgreSQL 시퀀스 동기화로 500 에러 원천 차단
        db.execute(text("SELECT setval('domain.mst_objects_object_id_seq', COALESCE((SELECT MAX(object_id) FROM domain.mst_objects), 1), true)"))
        db.commit()
        return {"status": "success", "message": f"총 {len(request.items)}건의 객체 데이터가 성공적으로 일괄 반영(Upsert) 되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))