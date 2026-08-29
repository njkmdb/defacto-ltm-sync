import os
import json
import math
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.models import EventRaw, EventFact, EventMemory
from schemas.api_schemas import StructureEventsRequest, StructureEventsResponse, StructureEventResult, PipelineStatusResponse, RawDataStatus, PaginationMeta
from services.lrse_client import LRSEClient
from services.prompt_manager import get_dynamic_prompt
from services.embedding_service import EmbeddingService
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LRSE_URL = os.getenv("LRSE_URL")
SESSION_ID = os.getenv("SESSION_ID")
SESSION_SECRET = os.getenv("SESSION_SECRET")
API_KEY = os.getenv("GEMINI_API_KEY") 
MODEL_NAME = os.getenv("MODEL_NAME")

async def process_structure_events(request: StructureEventsRequest, db: Session) -> StructureEventsResponse:
    lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET, api_key=API_KEY, model_name=MODEL_NAME)
    embedding_service = EmbeddingService(api_key=API_KEY)
    
    results = []
    success_count = fail_count = 0

    for raw_id in request.target_raw_ids:
        raw_record = db.query(EventRaw).filter(
            EventRaw.raw_id == raw_id,
            EventRaw.base_entity_id == request.base_entity_id 
        ).first()
        
        if not raw_record:
            results.append(StructureEventResult(raw_id=raw_id, sync_status_id=2, error_reason="원본 데이터 없음 또는 접근 권한이 없습니다."))
            fail_count += 1
            continue
            
        if raw_record.sync_status_id == 1 and not request.retry_failed:
            results.append(StructureEventResult(raw_id=raw_id, sync_status_id=1, event_id=None, error_reason="이미 처리된 데이터"))
            continue
            
        try:
            candidate_query = text("""
                SELECT entity_id, entity_name FROM domain.mst_entities 
                WHERE entity_id != 0 
                AND (
                    :raw_content ILIKE '%' || entity_name || '%' 
                    OR EXISTS (
                        SELECT 1 
                        FROM jsonb_array_elements_text(
                            CASE 
                                WHEN jsonb_typeof(attributes->'aliases') = 'array' THEN attributes->'aliases' 
                                ELSE '[]'::jsonb 
                            END
                        ) AS alias 
                        WHERE alias != '' AND :raw_content ILIKE '%' || alias || '%'
                    )
                )
                ORDER BY LENGTH(entity_name) DESC
                LIMIT 5
            """)
            candidates = db.execute(candidate_query, {"raw_content": raw_record.raw_content}).fetchall()
            candidate_list = [{"id": row[0], "name": row[1]} for row in candidates]
            candidate_json = json.dumps(candidate_list, ensure_ascii=False)
            
            enhanced_content = f"{raw_record.raw_content}\n\n[참고 마스터 데이터: {candidate_json}]"
            system_instruction, target_schema_cls, temp, max_len = get_dynamic_prompt(db, "A_EXTRACTION", request.base_entity_id, "HierarchicalFactSchema")
            structured_data = await lrse_client.extract_fact(
                raw_content=enhanced_content, target_schema_cls=target_schema_cls, system_instruction=system_instruction, temperature=temp, max_tokens=max_len
            )
            
            new_fact = EventFact(
                raw_id=raw_record.raw_id, base_entity_id=request.base_entity_id,
                target_entity_id=structured_data.ref_entity_id_1 or 0, target_object_id=0,
                event_date=raw_record.event_date, schema_name=target_schema_cls.__name__,
                fact_content=structured_data.fact_content, attributes=structured_data.attributes
            )
            db.add(new_fact)
            db.flush() 
            vector_data = await embedding_service.get_embedding(structured_data.content_text)
            new_memory = EventMemory(
                base_entity_id=request.base_entity_id, target_entity_id=structured_data.ref_entity_id_1 or 0, 
                target_object_id=0, event_date=raw_record.event_date, memory_type='LTM', 
                content_text=structured_data.content_text, core_keywords=structured_data.core_keywords,
                embedding=vector_data, source_event_ids=[new_fact.event_id]
            )
            db.add(new_memory)
            raw_record.sync_status_id = 1
            raw_record.error_log = None
            db.commit() 
            results.append(StructureEventResult(raw_id=raw_id, sync_status_id=1, event_id=new_fact.event_id))
            success_count += 1
            
        except Exception as e:
            db.rollback()
            raw_record.sync_status_id = 2
            raw_record.error_log = str(e)
            db.commit()
            results.append(StructureEventResult(raw_id=raw_id, sync_status_id=2, error_reason=str(e)))
            fail_count += 1

    status_str = "success" if fail_count == 0 else ("failed" if success_count == 0 else "partial_success")
    return StructureEventsResponse(status=status_str, message=f"총 {len(request.target_raw_ids)}건 중 {success_count}건 성공, {fail_count}건 실패", results=results)

def get_pipeline_status(db: Session, base_entity_id: int, page: int = 1, limit: int = 20, start_date: str = None, end_date: str = None, status_filter: str = None) -> dict:
    # 💡 [보안 결함 수정] 대시보드 관제 리스트 타사 데이터 무단 노출 원천 차단
    base_query = db.query(EventRaw).filter(
        EventRaw.sync_status_id != 9,
        EventRaw.base_entity_id == base_entity_id
    )
    if start_date:
        try: base_query = base_query.filter(EventRaw.event_date >= datetime.strptime(start_date, "%Y-%m-%d").date())
        except ValueError: pass
    if end_date:
        try: base_query = base_query.filter(EventRaw.event_date <= datetime.strptime(end_date, "%Y-%m-%d").date())
        except ValueError: pass 

    total = base_query.count()
    success = base_query.filter(EventRaw.sync_status_id == 1).count()
    failed = base_query.filter(EventRaw.sync_status_id == 2).count()
    pending = base_query.filter((EventRaw.sync_status_id == 0) | (EventRaw.sync_status_id.is_(None))).count()

    list_query = base_query
    if status_filter and status_filter != 'ALL':
        list_query = list_query.filter(EventRaw.sync_status_id == int(status_filter))

    total_list_count = list_query.count()
    total_pages = math.ceil(total_list_count / limit) if total_list_count > 0 else 1
    offset = (page - 1) * limit
    rows = list_query.order_by(EventRaw.raw_id.desc()).offset(offset).limit(limit).all()
    data_list = [{"raw_id": r.raw_id, "base_entity_id": r.base_entity_id, "sync_status_id": r.sync_status_id or 0, "event_date": r.event_date, "raw_content": r.raw_content, "error_log": r.error_log} for r in rows]

    return {"total_count": total, "success_count": success, "failed_count": failed, "pending_count": pending, "data_list": data_list, "meta": { "total_count": total_list_count, "current_page": page, "total_pages": total_pages, "limit": limit }}