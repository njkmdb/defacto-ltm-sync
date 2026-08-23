import os
import json
import math
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, cast, String, text
from database.models import EventMemory, EventBriefing, EventCreation
from schemas.api_schemas import (
    MemorySearchRequest, MemorySearchResponse, MemorySearchResultItem, PaginationMeta,
    GenerateBriefingRequest, SaveBriefingRequest, UpdateBriefingRequest
)
from services.embedding_service import EmbeddingService
from services.rag_service import RagService
from services.lrse_client import LRSEClient
from services.prompt_manager import get_dynamic_prompt
from services.synthesis_service import (
    get_ext_data_text, execute_fetch_entity_master,
    execute_fetch_object_master, execute_fetch_detailed_facts
)
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LRSE_URL = os.getenv("LRSE_URL")
SESSION_ID = os.getenv("SESSION_ID")
SESSION_SECRET = os.getenv("SESSION_SECRET")
API_KEY = os.getenv("GEMINI_API_KEY") 
MODEL_NAME = os.getenv("MODEL_NAME")

async def search_memory_explorer(request: MemorySearchRequest, db: Session) -> MemorySearchResponse:
    try:
        embedding_service = EmbeddingService(api_key=API_KEY)
        query_vector = await embedding_service.get_embedding(request.query_text)
        
        rag_service = RagService(db)
        results, meta = rag_service.explore_memories(
            query_embedding=query_vector,
            page=request.page,
            limit=request.limit,
            distance_threshold=request.distance_threshold,
            base_entity_id=request.base_entity_id,
            search_conditions=request.search_conditions,
            include_dwh=request.include_dwh
        )
        
        response_items = [MemorySearchResultItem(**res) for res in results]
        
        return MemorySearchResponse(status="success", data=response_items, meta=PaginationMeta(**meta))
    except Exception as e:
        logger.error(f"Memory Explorer 검색 실패: {str(e)}")
        raise Exception(f"기억 탐색 중 오류가 발생했습니다: {str(e)}")

async def generate_event_briefing(request: GenerateBriefingRequest, db: Session) -> dict:
    try:
        lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET, api_key=API_KEY, model_name=MODEL_NAME)
        
        memories = db.query(EventMemory).filter(EventMemory.memory_id.in_(request.selected_memory_ids)).all()
        all_source_ids = set()
        index_texts = []
        for mem in memories:
            if mem.source_event_ids:
                all_source_ids.update(mem.source_event_ids)
            target_str = f" | 타겟 주체 ID: {mem.target_entity_id}" if mem.target_entity_id else ""
            index_texts.append(f"- [연관 IDs: {mem.source_event_ids}{target_str}] {mem.content_text}")
            
        ext_data_text = get_ext_data_text(db, request.base_entity_id)
        index_text_joined = "\n".join(index_texts)
        index_payload = f"【선택된 기억 요약(Index)】\n{index_text_joined}\n\n【외부 정형 데이터】\n{ext_data_text}"
        
        logger.info("🤖 [Report Agent] 1차 Index 스캔 및 마스터/팩트 원문 필요성 판별 중 (Planning)...")
        plan_instruction, plan_schema_cls, plan_temp, plan_max_len = get_dynamic_prompt(db, "C_PLANNING", request.base_entity_id, "AgentPlanningSchema")
        
        plan_result = await lrse_client.extract_fact(
            raw_content=f"【사용자 질의(목적)】\n{request.query_text}\n\n{index_payload}", 
            target_schema_cls=plan_schema_cls, 
            system_instruction=plan_instruction,
            temperature=plan_temp,
            max_tokens=plan_max_len
        )
        
        additional_context_payload = ""
        required_event_ids = set(all_source_ids)
        
        if plan_result.tool_calls:
            for tool_call in plan_result.tool_calls:
                if tool_call.tool_name == "FETCH_FACT_DETAILS":
                    required_event_ids.update(tool_call.target_ids)
                elif tool_call.tool_name == "FETCH_ENTITY_MASTER":
                    if tool_call.target_ids:
                        entity_text = execute_fetch_entity_master(db, tool_call.target_ids)
                        additional_context_payload += f"\n\n{entity_text}"
                elif tool_call.tool_name == "FETCH_OBJECT_MASTER":
                    if tool_call.target_ids:
                        object_text = execute_fetch_object_master(db, tool_call.target_ids)
                        additional_context_payload += f"\n\n{object_text}"
        
        if required_event_ids:
            facts_text = execute_fetch_detailed_facts(db, list(required_event_ids), request.base_entity_id, override_limit=True)
            additional_context_payload += f"\n\n{facts_text}"
            
        final_prompt = f"【사용자 질의(목적)】\n{request.query_text}\n\n{index_payload}\n\n【에이전트 인출 데이터】\n{additional_context_payload}"
        
        logger.info(f"📝 [Briefing Gen] 에이전트 인출 데이터를 포함하여 전문 요약 리포트 생성 중 (Synthesis)...")
        synthesis_instruction, brief_schema_cls, brief_temp, brief_max_len = get_dynamic_prompt(db, "C_BRIEFING", request.base_entity_id, "EventBriefingSchema")
        
        report_data = await lrse_client.extract_fact(
            raw_content=final_prompt,
            target_schema_cls=brief_schema_cls,
            system_instruction=synthesis_instruction,
            temperature=brief_temp,
            max_tokens=brief_max_len
        )
        
        return {
            "status": "success",
            "message": "리포트 생성이 완료되었습니다.",
            "data": report_data.model_dump()
        }
    except Exception as e:
        logger.error(f"리포트 생성 실패: {str(e)}")
        raise Exception(f"리포트 생성 중 오류가 발생했습니다: {str(e)}")

def save_event_briefing(request: SaveBriefingRequest, db: Session) -> dict:
    try:
        new_report = EventBriefing(
            base_entity_id=request.base_entity_id,
            query_text=request.query_text,
            executive_summary=request.executive_summary,
            key_findings=request.key_findings,
            risk_and_warnings=request.risk_and_warnings,
            recommended_actions=request.recommended_actions,
            source_memory_ids=request.source_memory_ids
        )
        db.add(new_report)
        db.commit()
        return {"status": "success", "message": "시스템 아카이브에 요약 리포트가 영구 저장되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"리포트 저장 중 오류 발생: {str(e)}")

def get_event_briefings(db: Session, page: int = 1, limit: int = 20, base_entity_id: int = None, start_date: str = None, end_date: str = None, search_conditions: str = None) -> dict:
    query = db.query(EventBriefing)
    if base_entity_id:
        query = query.filter(EventBriefing.base_entity_id == base_entity_id)

    if start_date:
        try: query = query.filter(EventBriefing.ne_ts >= datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError: pass
    if end_date:
        try: query = query.filter(EventBriefing.ne_ts <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
        except ValueError: pass

    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                def build_cond(target, kw):
                    kw = kw.strip()
                    if target == 'BRIEFING_ID' and kw.isdigit(): return EventBriefing.briefing_id == int(kw)
                    elif target == 'ENTITY_ID' and kw.isdigit(): return EventBriefing.base_entity_id == int(kw)
                    elif target == 'SUMMARY': return EventBriefing.executive_summary.ilike(f"%{kw}%")
                    elif target == 'QUERY': return EventBriefing.query_text.ilike(f"%{kw}%")
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
                            if op == 'OR': combined_expr = or_(combined_expr, expr)
                            else: combined_expr = and_(combined_expr, expr)
                if combined_expr is not None:
                    query = query.filter(combined_expr)
        except Exception as e:
            logger.error(f"다중 검색 파싱 오류 (Briefing): {e}")

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    rows = query.order_by(EventBriefing.briefing_id.desc()).offset(offset).limit(limit).all()
    
    data = []
    for r in rows:
        data.append({
            "briefing_id": r.briefing_id,
            "base_entity_id": r.base_entity_id,
            "query_text": r.query_text,
            "executive_summary": r.executive_summary,
            "key_findings": r.key_findings or [],
            "risk_and_warnings": r.risk_and_warnings or [],
            "recommended_actions": r.recommended_actions or [],
            "source_memory_ids": r.source_memory_ids or [],
            "up_ts": r.up_ts,
            "ne_ts": r.ne_ts
        })
        
    return {
        "status": "success",
        "data": data,
        "meta": { "total_count": total, "current_page": page, "total_pages": total_pages, "limit": limit }
    }

def get_briefing_audit_trail(briefing_id: int, db: Session) -> dict:
    report = db.query(EventBriefing).filter(EventBriefing.briefing_id == briefing_id).first()
    if not report:
        raise Exception("해당 리포트를 찾을 수 없습니다.")
        
    if not report.source_memory_ids:
        return {"status": "success", "data": []}
        
    memories = db.query(EventMemory).filter(EventMemory.memory_id.in_(report.source_memory_ids)).order_by(EventMemory.event_date.desc()).all()
    data = []
    for m in memories:
        data.append({
            "memory_id": m.memory_id,
            "content_text": m.content_text,
            "event_date": m.event_date,
            "source_event_ids": m.source_event_ids or []
        })
        
    return {"status": "success", "data": data}

def get_event_briefing(briefing_id: int, db: Session) -> dict:
    r = db.query(EventBriefing).filter(EventBriefing.briefing_id == briefing_id).first()
    if not r:
        raise Exception("해당 리포트를 찾을 수 없습니다.")
    return {
        "status": "success",
        "data": {
            "briefing_id": r.briefing_id,
            "base_entity_id": r.base_entity_id,
            "query_text": r.query_text,
            "executive_summary": r.executive_summary,
            "key_findings": r.key_findings or [],
            "risk_and_warnings": r.risk_and_warnings or [],
            "recommended_actions": r.recommended_actions or [],
            "source_memory_ids": r.source_memory_ids or [],
            "up_ts": r.up_ts,
            "ne_ts": r.ne_ts
        }
    }

def update_event_briefing(briefing_id: int, request: UpdateBriefingRequest, db: Session) -> dict:
    try:
        r = db.query(EventBriefing).filter(EventBriefing.briefing_id == briefing_id).first()
        if not r:
            raise Exception("해당 리포트를 찾을 수 없습니다.")
            
        r.query_text = request.query_text
        r.executive_summary = request.executive_summary
        r.key_findings = request.key_findings
        r.risk_and_warnings = request.risk_and_warnings
        r.recommended_actions = request.recommended_actions
        r.up_ts = datetime.utcnow()
        
        db.commit()
        return {"status": "success", "message": "요약 리포트가 성공적으로 수정되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"리포트 수정 중 오류 발생: {str(e)}")

def delete_event_briefing(briefing_id: int, db: Session) -> dict:
    try:
        r = db.query(EventBriefing).filter(EventBriefing.briefing_id == briefing_id).first()
        if not r:
            raise Exception("해당 리포트를 찾을 수 없습니다.")
        
        linked_creations = db.query(EventCreation).filter(EventCreation.source_briefing_ids.contains([briefing_id])).all()
        for c in linked_creations:
            c.source_briefing_ids = [bid for bid in c.source_briefing_ids if bid != briefing_id]

        db.delete(r)
        db.commit()
        return {"status": "success", "message": "요약 리포트가 영구 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"리포트 삭제 중 오류 발생: {str(e)}")

def delete_bulk_event_briefings(briefing_ids: list[int], db: Session) -> dict:
    try:
        # 💡 [AST Depth Limit 최적화] or_ 전개 대신 EXISTS와 jsonb_array_elements를 활용한 단일 쿼리로 최적화
        if briefing_ids:
            ids_csv = ",".join(f"'{bid}'" for bid in briefing_ids)
            linked_creations = db.query(EventCreation).filter(
                text(f"EXISTS (SELECT 1 FROM jsonb_array_elements(source_briefing_ids) AS elem WHERE elem::text IN ({ids_csv}))")
            ).all()
            for c in linked_creations:
                c.source_briefing_ids = [bid for bid in c.source_briefing_ids if bid not in briefing_ids]

        db.query(EventBriefing).filter(EventBriefing.briefing_id.in_(briefing_ids)).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "message": f"총 {len(briefing_ids)}건의 리포트가 일괄 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"리포트 일괄 삭제 중 오류 발생: {str(e)}")