import os
import json
import logging
from typing import List
from datetime import date
from collections import Counter
from sqlalchemy.orm import Session
from database.models import EventFact, MstEntity, MstObject, EventMemory, ExtMst, ExtEvent, EventRaw
from schemas.api_schemas import (
    SynthesizeContextRequest, SynthesizeContextResponse, SynthesizeContextData,
    SynthesizedData, RagMetrics, FactCheckRequest
)
from services.lrse_client import LRSEClient
from services.rag_orchestrator import RagOrchestrator
from services.prompt_manager import get_dynamic_prompt
from services.embedding_service import EmbeddingService
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LRSE_URL = os.getenv("LRSE_URL", "http://127.0.0.1:8080")
SESSION_ID = os.getenv("SESSION_ID", "default_session")
SESSION_SECRET = os.getenv("SESSION_SECRET", "default_secret")

MAX_FETCH_LIMIT = 15

def execute_fetch_detailed_facts(db: Session, event_ids: List[int], base_entity_id: int, override_limit: bool = False) -> str:
    if not event_ids: return ""
    query = db.query(EventFact).filter(EventFact.event_id.in_(event_ids))
    query = query.filter(EventFact.base_entity_id == base_entity_id)
    query = query.order_by(EventFact.event_date.desc())
    if not override_limit: query = query.limit(MAX_FETCH_LIMIT)
    facts = query.all()
    if not facts: return "[시스템 알림: 요청한 ID에 해당하는 팩트 원문을 찾을 수 없거나 접근 권한이 없습니다]"
        
    details = ["【인출된 상세 팩트(Detail) 원문 데이터】"]
    for f in facts:
        fact_str = f"► [팩트 ID: {f.event_id} | 발생일: {f.event_date}]\n- 원문 내용: {f.fact_content}"
        if f.attributes: fact_str += f"\n- 메타데이터: {json.dumps(f.attributes, ensure_ascii=False)}"
        details.append(fact_str)
    if not override_limit and len(event_ids) > MAX_FETCH_LIMIT:
        details.append(f"\n\n[System Alert: 컨텍스트 보호 모드 가동. 토큰 한계로 인해 에이전트가 요청한 전체 {len(event_ids)}건 중 최신 {MAX_FETCH_LIMIT}건만 인출되었습니다.]")
    return "\n\n".join(details)

def execute_fetch_entity_master(db: Session, entity_ids: List[int]) -> str:
    if not entity_ids: return ""
    entities = db.query(MstEntity).filter(MstEntity.entity_id.in_(entity_ids)).all()
    if not entities: return "[시스템 알림: 해당 주체(Entity)의 마스터 데이터를 찾을 수 없습니다]"
    details = ["【인출된 주체 마스터(Entity Master) 데이터】"]
    for e in entities: details.append(f"► [주체 ID: {e.entity_id} | 타입: {e.entity_type} | 이름: {e.entity_name}]\n- 속성(Attributes): {json.dumps(e.attributes, ensure_ascii=False)}")
    return "\n\n".join(details)

def execute_fetch_object_master(db: Session, object_ids: List[int]) -> str:
    if not object_ids: return ""
    objects = db.query(MstObject).filter(MstObject.object_id.in_(object_ids)).all()
    if not objects: return "[시스템 알림: 해당 객체(Object)의 마스터 데이터를 찾을 수 없습니다]"
    details = ["【인출된 객체 마스터(Object Master) 데이터】"]
    for o in objects: details.append(f"► [객체 ID: {o.object_id} | 타입: {o.object_type} | 이름: {o.object_name}]\n- 속성(Attributes): {json.dumps(o.attributes, ensure_ascii=False)}")
    return "\n\n".join(details)

def get_ext_data_text(db: Session, base_entity_id: int) -> str:
    try:
        mst_data = db.query(ExtMst).filter(ExtMst.base_entity_id == base_entity_id).order_by(ExtMst.up_ts.desc()).limit(10).all()
        event_data = db.query(ExtEvent).filter(ExtEvent.base_entity_id == base_entity_id).order_by(ExtEvent.event_date.desc()).limit(5).all()
        ext_texts = []
        if mst_data:
            ext_texts.append("【외부 정형 마스터 정보】")
            for m in mst_data: ext_texts.append(f"- [출처: {m.ext_source} | 유형: {m.ext_type}]: {json.dumps(m.attributes, ensure_ascii=False)}")
        if event_data:
            ext_texts.append("\n【외부 정형 이벤트 내역】")
            for e in event_data:
                amount_str = f" | 금액: {e.event_amount:,.0f}원" if e.event_amount else ""
                ext_texts.append(f"- [{e.event_date}] 출처: {e.ext_source} | 유형: {e.event_type}{amount_str} | 속성: {json.dumps(e.attributes, ensure_ascii=False)}")
        if not ext_texts: return "해당 주체와 연동된 외부 정형 데이터가 없습니다."
        return "\n".join(ext_texts)
    except Exception as e:
        logger.error(f"외부 정형 데이터 조회 실패: {str(e)}")
        return "외부 정형 데이터 조회 중 오류가 발생했습니다."

async def process_synthesize_context(request: SynthesizeContextRequest, db: Session, target_lang: str = "Korean") -> SynthesizeContextResponse:
    lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET)
    rag_service = RagOrchestrator(db)
    embedding_service = EmbeddingService()

    today_raws = db.query(EventRaw.raw_id).filter(EventRaw.base_entity_id == request.base_entity_id, EventRaw.event_date == request.reference_date, EventRaw.sync_status_id == 1).all()
    today_raw_ids = [r[0] for r in today_raws]

    if not today_raw_ids:
        return SynthesizeContextResponse(status="success", data=SynthesizeContextData(log_id=0, synthesized_data=SynthesizedData(llm_summary=f"{request.reference_date} 일자의 처리된 활동 내역이 없습니다.", action_items=[]), rag_metrics=RagMetrics(cache_hit=False, memory_type_used="NONE")))

    today_memories = db.query(EventMemory).filter(EventMemory.base_entity_id == request.base_entity_id, EventMemory.event_date == request.reference_date, EventMemory.memory_type == 'LTM').all()
    unique_memories = list({m.memory_id: m for m in today_memories}.values())
    today_text = "\n".join([f"- [연관 IDs: {m.source_event_ids} | 타겟 주체 ID: {m.target_entity_id}] {m.content_text}" for m in unique_memories])

    today_facts = db.query(EventFact.target_entity_id, EventFact.target_object_id).filter(EventFact.base_entity_id == request.base_entity_id, EventFact.event_date == request.reference_date).all()
    target_entity_ids = [f.target_entity_id for f in today_facts if f.target_entity_id and f.target_entity_id != 0]
    target_entity_id = Counter(target_entity_ids).most_common(1)[0][0] if target_entity_ids else 0
    target_object_ids = [f.target_object_id for f in today_facts if f.target_object_id and f.target_object_id != 0]
    target_object_id = Counter(target_object_ids).most_common(1)[0][0] if target_object_ids else 0

    target_entity_names = [e.entity_name for e in db.query(MstEntity).filter(MstEntity.entity_id.in_([target_entity_id])).all()] if target_entity_id else []
    search_query_text = " ".join([m.content_text for m in unique_memories]).strip()
    ext_data_text = get_ext_data_text(db, request.base_entity_id)
    if target_entity_names: search_query_text += f" [핵심 타겟: {', '.join(target_entity_names)}] 연관 과거 이력 검색"
    if not search_query_text.strip(): search_query_text = "최근 발생한 중요 이벤트 및 비즈니스 활동 이력 검색"

    query_vector = await embedding_service.get_embedding(search_query_text)
    rag_results = rag_service.get_optimal_context(base_entity_id=request.base_entity_id, query_embedding=query_vector, reference_date=request.reference_date, target_entity_id=target_entity_id, target_object_id=target_object_id)

    def format_index(m):
        ids = m.get('source_event_ids', []) if isinstance(m, dict) else (m.source_event_ids if hasattr(m, 'source_event_ids') else [])
        t_id = m.get('target_entity_id', 0) if isinstance(m, dict) else (m.target_entity_id if hasattr(m, 'target_entity_id') else 0)
        txt = m.get('content_text', '') if isinstance(m, dict) else m.content_text
        target_str = f" | 타겟 주체 ID: {t_id}" if t_id else ""
        return f"- [연관 IDs: {ids}{target_str}] {txt}"

    track1_text = "\n".join([format_index(m) for m in rag_results.get("track1", [])])
    track2_text = "\n".join([format_index(m) for m in rag_results.get("track2", [])])

    index_payload = f"【오늘의 단기 요약(Index)】\n{today_text}\n\n【외부 정형 데이터】\n{ext_data_text}\n\n"
    if track1_text: index_payload += f"【과거 이력 요약(Index)】\n{track1_text}\n\n"
    if track2_text: index_payload += f"【전사 유사 사례 요약(Index)】\n{track2_text}"

    if getattr(request, 'use_deep_search', False):
        all_ids = set()
        for m in unique_memories:
            source_ids = m.source_event_ids if hasattr(m, 'source_event_ids') else m.get("source_event_ids", [])
            all_ids.update(source_ids)
        for track in ["track1", "track2"]:
            for m in rag_results.get(track, []):
                source_ids = m.get("source_event_ids", []) if isinstance(m, dict) else getattr(m, "source_event_ids", [])
                all_ids.update(source_ids)
        fetched_details = execute_fetch_detailed_facts(db, list(all_ids), request.base_entity_id, override_limit=True)
        rag_metrics_type = "Deep Search (All Facts Extracted)"
    else:
        plan_instruction, plan_schema_cls, plan_temp, plan_max_len = get_dynamic_prompt(db, "B_PLANNING", request.base_entity_id, "AgentPlanningSchema", target_lang)
        plan_result = await lrse_client.extract_fact(raw_content=index_payload, target_schema_cls=plan_schema_cls, system_instruction=plan_instruction, temperature=plan_temp, max_tokens=plan_max_len)
        additional_context_payload = ""
        metrics_tools_used = set()
        required_fact_ids = set()
        if plan_result.tool_calls:
            for tool_call in plan_result.tool_calls:
                if tool_call.tool_name == "FETCH_FACT_DETAILS":
                    required_fact_ids.update(tool_call.target_ids)
                    metrics_tools_used.add("FETCH_FACT_DETAILS")
                elif tool_call.tool_name == "FETCH_ENTITY_MASTER" and tool_call.target_ids:
                    additional_context_payload += f"\n\n{execute_fetch_entity_master(db, tool_call.target_ids)}"
                    metrics_tools_used.add("FETCH_ENTITY_MASTER")
                elif tool_call.tool_name == "FETCH_OBJECT_MASTER" and tool_call.target_ids:
                    additional_context_payload += f"\n\n{execute_fetch_object_master(db, tool_call.target_ids)}"
                    metrics_tools_used.add("FETCH_OBJECT_MASTER")
        for track in ["track1", "track2"]:
            for mem in rag_results.get(track, []):
                distance = mem.get("base_distance", 1.0) if isinstance(mem, dict) else getattr(mem, "base_distance", 1.0)
                if distance <= 0.15:
                    source_ids = mem.get("source_event_ids", []) if isinstance(mem, dict) else getattr(mem, "source_event_ids", [])
                    required_fact_ids.update(source_ids)
        if required_fact_ids:
            additional_context_payload += f"\n\n{execute_fetch_detailed_facts(db, list(required_fact_ids), request.base_entity_id)}"
        fetched_details = additional_context_payload
        rag_metrics_type = "Agentic Dual-Track RAG (SUFFICIENT_INFO)" if not metrics_tools_used else f"Agentic Tool Calls: {', '.join(metrics_tools_used)}"

    synthesis_instruction, synth_schema_cls, synth_temp, synth_max_len = get_dynamic_prompt(db, "B_SYNTHESIS", request.base_entity_id, "ContextSynthesisSchema", target_lang)
    synthesized_result = await lrse_client.extract_fact(
        raw_content=f"{index_payload}\n\n{fetched_details}", target_schema_cls=synth_schema_cls, system_instruction=synthesis_instruction, temperature=synth_temp, max_tokens=synth_max_len
    )

    return SynthesizeContextResponse(
        status="success", data=SynthesizeContextData(log_id=999, synthesized_data=SynthesizedData(llm_summary=synthesized_result.llm_summary, action_items=synthesized_result.action_items), rag_metrics=RagMetrics(cache_hit=False, memory_type_used=rag_metrics_type))
    )

async def process_fact_check(request: FactCheckRequest, db: Session, target_lang: str = "Korean") -> dict:
    lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET)
    today_memories = db.query(EventMemory).filter(EventMemory.base_entity_id == request.base_entity_id, EventMemory.event_date == request.reference_date, EventMemory.memory_type == 'LTM').all()
    unique_memories = list({m.memory_id: m for m in today_memories}.values())
    if not unique_memories: return {"has_conflict": False, "discrepancies": []}

    # [N+1 쿼리 최적화] 모든 source_event_ids를 수집하여 단일 쿼리로 Bulk Fetch
    all_source_ids = set()
    for m in unique_memories:
        if m.source_event_ids:
            all_source_ids.update(m.source_event_ids)
            
    fact_to_raw_map = {}
    if all_source_ids:
        facts = db.query(EventFact.event_id, EventFact.raw_id).filter(EventFact.event_id.in_(all_source_ids)).all()
        fact_to_raw_map = {f.event_id: str(f.raw_id) for f in facts if f.raw_id}

    ltm_texts = []
    for m in unique_memories:
        source_ids = m.source_event_ids or []
        raw_ids = []
        if source_ids:
            raw_ids = [fact_to_raw_map[i] for i in source_ids if i in fact_to_raw_map]
        
        raw_id_str = f" | 원본 raw_id: {', '.join(raw_ids)}" if raw_ids else ""
        ltm_texts.append(f"- [기억 ID: {m.memory_id}{raw_id_str}] {m.content_text}")

    today_text = "\n".join(ltm_texts)
    ext_data_text = get_ext_data_text(db, request.base_entity_id)
    check_payload = f"【비정형 기억(LTM)】\n{today_text}\n\n【외부 정형 데이터(EXT)】\n{ext_data_text}"
    
    check_instruction, check_schema_cls, check_temp, check_max_len = get_dynamic_prompt(db, "B_FACT_CHECK", request.base_entity_id, "FactCheckSchema", target_lang)
    check_result = await lrse_client.extract_fact(raw_content=check_payload, target_schema_cls=check_schema_cls, system_instruction=check_instruction, temperature=check_temp, max_tokens=check_max_len)
    return check_result.model_dump()