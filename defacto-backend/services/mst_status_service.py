import json
import math
import logging
from datetime import datetime 
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, and_, or_
from sqlalchemy.dialects.postgresql import insert 
from sqlalchemy.exc import IntegrityError 
from database.models import MstStatus
from schemas.api_schemas import (
    CreateMstStatusRequest, UpdateMstStatusRequest, BulkUpsertMstStatusRequest
)

logger = logging.getLogger(__name__)

def get_lang_code(target_lang: str) -> str:
    lang_map = {"Japanese": "ja", "English": "en", "Korean": "ko"}
    return lang_map.get(target_lang, "ko")

def validate_status_id_range(status_id: int, category: str):
    if category == 'SYSTEM' and not (0 <= status_id <= 9):
        raise Exception("SYSTEM 카테고리는 0~9 번호만 사용할 수 있습니다.")
    elif category == 'ENTITY' and not (10 <= status_id <= 99):
        raise Exception("ENTITY 카테고리는 10~99 번호만 사용할 수 있습니다.")
    elif category == 'OBJECT' and not (100 <= status_id <= 199):
        raise Exception("OBJECT 카테고리는 100~199 번호만 사용할 수 있습니다.")
    elif category == 'TRANSACTION' and not (200 <= status_id <= 299):
        raise Exception("TRANSACTION 카테고리는 200~299 번호만 사용할 수 있습니다.")
    elif category == 'WORKFLOW' and not (300 <= status_id <= 399):
        raise Exception("WORKFLOW 카테고리는 300~399 번호만 사용할 수 있습니다.")

def get_active_status_options(category: str, db: Session, target_lang: str = "Korean") -> dict:
    query = db.query(MstStatus).filter(MstStatus.is_active == True)
    if category: 
        query = query.filter(MstStatus.domain_category == category)
    statuses = query.order_by(MstStatus.status_id.asc()).all()
    
    lang_code = get_lang_code(target_lang)
    data = []
    for s in statuses:
        final_name = s.status_name
        if s.attributes and f"name_{lang_code}" in s.attributes:
            final_name = s.attributes[f"name_{lang_code}"]
            
        data.append({"status_id": s.status_id, "status_name": final_name})
        
    return {"status": "success", "data": data}

def get_mst_statuses(db: Session, page: int = 1, limit: int = 20, category_filter: str = None, search_conditions: str = None, target_lang: str = "Korean") -> dict:
    query = db.query(MstStatus)
    
    if category_filter and category_filter != 'ALL':
        query = query.filter(MstStatus.domain_category == category_filter)
        
    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                def build_cond(target, kw):
                    kw = kw.strip()
                    if target == 'ID' and kw.isdigit(): return MstStatus.status_id == int(kw)
                    elif target == 'CATEGORY': return MstStatus.domain_category.ilike(f"%{kw}%")
                    elif target == 'NAME': return MstStatus.status_name.ilike(f"%{kw}%")
                    return None

                combined_expr = None
                for c in conds:
                    kw = c.get('keyword', '')
                    if not kw.strip(): continue
                    expr = build_cond(c.get('target'), kw)
                    if expr is not None:
                        if combined_expr is None: 
                            combined_expr = expr
                        else:
                            op = c.get('operator', 'AND')
                            if op == 'OR': 
                                combined_expr = or_(combined_expr, expr)
                            else: 
                                combined_expr = and_(combined_expr, expr)
                
                if combined_expr is not None:
                    query = query.filter(combined_expr)
        except Exception as e:
            logger.error(f"다중 검색 파싱 오류 (Status): {e}")
            pass
        
    total_count = query.count()
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    offset = (page - 1) * limit
    
    statuses = query.order_by(MstStatus.status_id.asc()).offset(offset).limit(limit).all()
    
    lang_code = get_lang_code(target_lang)
    data = []
    for s in statuses:
        final_name = s.status_name
        if s.attributes and f"name_{lang_code}" in s.attributes:
            final_name = s.attributes[f"name_{lang_code}"]
            
        data.append({
            "status_id": s.status_id, 
            "domain_category": s.domain_category, 
            "status_name": final_name, 
            "attributes": s.attributes or {},
            "is_active": s.is_active, 
            "ne_ts": s.ne_ts, 
            "up_ts": s.up_ts
        })
    
    return {"status": "success", "data": data, "meta": { "total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit }}

def create_mst_status(request: CreateMstStatusRequest, db: Session) -> dict:
    try:
        validate_status_id_range(request.status_id, request.domain_category)
        existing = db.query(MstStatus).filter(MstStatus.status_id == request.status_id).first()
        if existing: 
            raise Exception(f"이미 사용 중인 상태 ID ({request.status_id}) 입니다.")
        
        new_status = MstStatus(
            status_id=request.status_id, 
            domain_category=request.domain_category, 
            status_name=request.status_name, 
            attributes=request.attributes,
            is_active=request.is_active
        )
        db.add(new_status)
        db.commit()
        return {"status": "success", "message": "신규 상태 마스터가 등록되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def update_mst_status(status_id: int, request: UpdateMstStatusRequest, db: Session) -> dict:
    try:
        if status_id < 10: 
            raise Exception("시스템 파이프라인 코어 상태(ID 0~9)는 수정할 수 없습니다.")
        validate_status_id_range(request.status_id, request.domain_category)
        
        status_obj = db.query(MstStatus).filter(MstStatus.status_id == status_id).first()
        if not status_obj: 
            raise Exception("대상을 찾을 수 없습니다.")
        
        if request.status_id != status_id:
            existing = db.query(MstStatus).filter(MstStatus.status_id == request.status_id).first()
            if existing: 
                raise Exception(f"이미 사용 중인 상태 ID ({request.status_id}) 입니다.")
            status_obj.status_id = request.status_id
            
        status_obj.domain_category = request.domain_category
        status_obj.status_name = request.status_name
        status_obj.attributes = request.attributes
        status_obj.is_active = request.is_active
        db.commit()
        return {"status": "success", "message": "상태 데이터가 성공적으로 수정되었습니다."}
    except IntegrityError:
        db.rollback()
        raise Exception("해당 상태 ID는 트랜잭션에서 참조 중이므로 변경할 수 없습니다.")
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_mst_status(status_id: int, db: Session) -> dict:
    try:
        if status_id < 10: 
            raise Exception("시스템 코어 상태(ID 0~9)는 삭제할 수 없습니다.")
        status_obj = db.query(MstStatus).filter(MstStatus.status_id == status_id).first()
        if not status_obj: 
            return {"status": "error", "message": "대상을 찾을 수 없습니다."}
        
        db.delete(status_obj) 
        db.commit()
        return {"status": "success", "message": "해당 상태 마스터가 영구 삭제(Hard Delete) 되었습니다."}
    except IntegrityError:
        db.rollback()
        raise Exception("해당 상태 코드는 이미 다른 테이블(주체/객체/이벤트 등)에서 사용(참조) 중이므로 삭제할 수 없습니다.")
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def delete_bulk_mst_statuses(status_ids: list[int], db: Session) -> dict:
    try:
        for sid in status_ids:
            if sid < 10: 
                raise Exception("선택 항목에 시스템 코어 상태(ID 0~9)가 포함되어 있어 일괄 삭제가 중단되었습니다.")
            
        statuses = db.query(MstStatus).filter(MstStatus.status_id.in_(status_ids)).all()
        for s in statuses:
            db.delete(s)
            
        db.commit() 
        return {"status": "success", "message": f"총 {len(statuses)}건의 상태 마스터가 영구 삭제되었습니다."}
    except IntegrityError:
        db.rollback()
        raise Exception("선택한 상태 코드 중 이미 다른 데이터에서 사용 중인 코드가 포함되어 있어 삭제를 중단했습니다.")
    except Exception as e:
        db.rollback()
        raise Exception(str(e))

def bulk_upsert_mst_statuses(request: BulkUpsertMstStatusRequest, db: Session) -> dict:
    try:
        if not request.items: 
            return {"status": "success", "message": "처리할 데이터가 없습니다."}
        for item in request.items:
            if item.status_id < 10:
                raise Exception(f"시스템 코어 상태(ID {item.status_id})는 엑셀을 통해 일괄 변경할 수 없습니다.")
            
            validate_status_id_range(item.status_id, item.domain_category)
            
            stmt = insert(MstStatus).values(
                status_id=item.status_id, 
                domain_category=item.domain_category,
                status_name=item.status_name, 
                attributes=item.attributes,
                is_active=item.is_active, 
                up_ts=datetime.utcnow()
            )
            update_dict = {
                "domain_category": stmt.excluded.domain_category,
                "status_name": stmt.excluded.status_name,
                "attributes": stmt.excluded.attributes,
                "is_active": stmt.excluded.is_active,
                "up_ts": datetime.utcnow()
            }
            stmt = stmt.on_conflict_do_update(index_elements=['status_id'], set_=update_dict)
            db.execute(stmt)
            
        db.commit()
        return {"status": "success", "message": f"총 {len(request.items)}건의 상태 데이터가 일괄 반영(Upsert) 되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(str(e))