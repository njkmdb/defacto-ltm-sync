import os
import json
import logging
from typing import Dict, Any
from datetime import date, datetime
from sqlalchemy.orm import Session

from services.pipeline_core import BaseNode, PipelineContext
from services.rag_orchestrator import RagOrchestrator
from services.embedding_service import EmbeddingService
from services.lrse_client import LRSEClient
from services.prompt_manager import get_dynamic_prompt, SCHEMA_REGISTRY
from services.synthesis_service import get_ext_data_text
from database.models import EventLog

logger = logging.getLogger(__name__)

LRSE_URL = os.getenv("LRSE_URL", "http://127.0.0.1:8080")
SESSION_ID = os.getenv("SESSION_ID", "default_session")
SESSION_SECRET = os.getenv("SESSION_SECRET", "default_secret")
API_KEY = os.getenv("GEMINI_API_KEY", "") 
MODEL_NAME = os.getenv("MODEL_NAME", "gemini-1.5-pro")

class LTMSearchNode(BaseNode):
    """
    [Node 1] RAG 오케스트레이터를 호출하여 과거 기억(LTM) 및 Cache에서 문맥을 벡터 검색하는 노드
    """
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        query_text = params.get("query_text", "")
        reference_date_str = params.get("reference_date")
        target_entity_id = int(params.get("target_entity_id", 0))
        target_object_id = int(params.get("target_object_id", 0))
        top_k = int(params.get("top_k", 3))
        
        if reference_date_str:
            if isinstance(reference_date_str, date):
                ref_date = reference_date_str
            elif isinstance(reference_date_str, str):
                ref_date = datetime.strptime(reference_date_str, "%Y-%m-%d").date()
            else:
                ref_date = date.today()
        else:
            ref_date = date.today()
        
        embedding_service = EmbeddingService(api_key=API_KEY)
        query_vector = await embedding_service.get_embedding(query_text)
        
        rag_service = RagOrchestrator(db)
        results = rag_service.get_optimal_context(
            base_entity_id=context.base_entity_id,
            query_embedding=query_vector,
            reference_date=ref_date,
            target_entity_id=target_entity_id,
            target_object_id=target_object_id
        )
        
        def format_index(m):
            ids = m.get('source_event_ids', []) if isinstance(m, dict) else (getattr(m, 'source_event_ids', []))
            t_id = m.get('target_entity_id', 0) if isinstance(m, dict) else (getattr(m, 'target_entity_id', 0))
            txt = m.get('content_text', '') if isinstance(m, dict) else getattr(m, 'content_text', '')
            target_str = f" | 타겟 주체 ID: {t_id}" if t_id else ""
            return f"- [연관 IDs: {ids}{target_str}] {txt}"

        track1_list = results.get("track1", [])[:top_k]
        track2_list = results.get("track2", [])[:top_k]

        track1_text = "\n".join([format_index(m) for m in track1_list])
        track2_text = "\n".join([format_index(m) for m in track2_list])
        
        combined_text = ""
        if track1_text:
            combined_text += f"【관계 중심 검색(Track 1)】\n{track1_text}\n\n"
        if track2_text:
            combined_text += f"【전역 인사이트 검색(Track 2)】\n{track2_text}\n\n"

        return {
            "track1": track1_list,
            "track2": track2_list,
            "formatted_text": combined_text.strip()
        }

class FetchExtDataNode(BaseNode):
    """
    [Node 2] ERP/CRM 등의 외부 정형 데이터(EXT)를 데이터베이스에서 조회하는 노드
    """
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        ext_data_text = get_ext_data_text(db, context.base_entity_id)
        return ext_data_text

class PreFactCheckNode(BaseNode):
    """
    [Node 3] LLM에 의한 Hallucination 방지를 위해 외부 정형 데이터와 교차 검증을 선행하는 노드
    """
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        ltm_context_text = params.get("ltm_context_text", "")
        ext_data_text = params.get("ext_data_text", "")
        
        # 프론트엔드의 use_pre_fact_check 파라미터가 연동되도록 적용
        raw_flag = params.get("use_pre_fact_check", True)
        if isinstance(raw_flag, str):
            abort_on_conflict = raw_flag.lower() == 'true'
        else:
            abort_on_conflict = bool(raw_flag)
            
        if not abort_on_conflict:
            return {"has_conflict": False, "discrepancies": []}
        
        if not ext_data_text:
            ext_data_text = get_ext_data_text(db, context.base_entity_id)
            
        check_payload = f"【비정형 기억(LTM)】\n{ltm_context_text}\n\n【외부 정형 데이터(EXT)】\n{ext_data_text}"
        sys_instruction, schema_cls, temp, max_len = get_dynamic_prompt(db, "B_FACT_CHECK", context.base_entity_id, "FactCheckSchema")
        
        lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET, api_key=API_KEY, model_name=MODEL_NAME)
        check_result = await lrse_client.extract_fact(
            raw_content=check_payload, 
            target_schema_cls=schema_cls, 
            system_instruction=sys_instruction, 
            temperature=temp, 
            max_tokens=max_len
        )
        
        res_dict = check_result.model_dump()
        
        if abort_on_conflict and res_dict.get("has_conflict"):
            # 💡 [Sprint 4] 파이프라인을 즉시 중단하고 프론트엔드 모달을 띄우기 위한 특수 예외 발생 (트랜잭션 롤백 수반)
            raise ValueError(f"FACT_CONFLICT::{json.dumps(res_dict['discrepancies'], ensure_ascii=False)}")
            
        return res_dict

class LLMGenerateNode(BaseNode):
    """
    [Node 4] 범용 LLM 생성 노드 (지정된 스키마와 프롬프트를 바탕으로 데이터 구조화/생성)
    """
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        prompt_step = params.get("pipeline_step", "B_SYNTHESIS")
        default_schema = params.get("schema_name", "ContextSynthesisSchema")
        raw_content = params.get("raw_content", "")
        
        sys_instruction, synth_schema_cls, synth_temp, synth_max_len = get_dynamic_prompt(
            db, prompt_step, context.base_entity_id, default_schema
        )
        
        # 프론트엔드 파이프라인 빌더에서 오버라이드(Override)한 파라미터가 있다면 동적 적용
        if "temperature" in params:
            synth_temp = float(params["temperature"])
        if "max_length" in params:
            synth_max_len = int(params["max_length"])
        if "system_instruction" in params and params["system_instruction"]:
            sys_instruction = params["system_instruction"]
        if "schema_name" in params and params["schema_name"] in SCHEMA_REGISTRY:
            synth_schema_cls = SCHEMA_REGISTRY[params["schema_name"]]
        
        lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET, api_key=API_KEY, model_name=MODEL_NAME)
        
        result = await lrse_client.extract_fact(
            raw_content=raw_content, 
            target_schema_cls=synth_schema_cls, 
            system_instruction=sys_instruction, 
            temperature=synth_temp, 
            max_tokens=synth_max_len
        )
        return result.model_dump()

class PersistDBNode(BaseNode):
    """
    [Node 5] 산출된 최종 데이터를 지정된 물리 테이블에 안전하게 Upsert하는 노드
    """
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        target_table = params.get("target_table")
        data = params.get("data", {})
        
        if target_table == "event_logs":
            reference_date_str = params.get("reference_date")
            if reference_date_str:
                if isinstance(reference_date_str, date):
                    ref_date = reference_date_str
                elif isinstance(reference_date_str, str):
                    ref_date = datetime.strptime(reference_date_str, "%Y-%m-%d").date()
                else:
                    ref_date = date.today()
            else:
                ref_date = date.today()
            
            new_log = EventLog(
                base_entity_id=context.base_entity_id,
                log_date=ref_date,
                schema_name=params.get("schema_name", "ContextSynthesisSchema"),
                llm_summary=data.get("llm_summary", ""),
                action_items=data.get("action_items", [])
            )
            db.add(new_log)
            db.flush()
            return {"inserted_id": new_log.log_id, "table": target_table}
            
        return {"status": "ignored", "message": f"Unsupported table: {target_table}"}

class TestErrorNode(BaseNode):
    """
    [Sprint 4 QA] 트랜잭션 롤백 테스트용 인위적 예외 발생 노드
    """
    async def execute(self, params: Dict[str, Any], context: PipelineContext, db: Session) -> Any:
        trigger_error = params.get("trigger_error", False)
        if isinstance(trigger_error, str):
            trigger_error = trigger_error.lower() == 'true'
            
        if trigger_error:
            logger.error("🚨 [QA TEST] 트랜잭션 롤백 유발용 인위적 에러가 발생했습니다.")
            raise ValueError("[Shadow Mode QA] 인위적인 에러 발생! 이전 노드에서 삽입된 DB 트랜잭션이 안전하게 롤백됩니다.")
        return {"status": "passed"}


def build_node_registry() -> Dict[str, BaseNode]:
    """
    오케스트레이터가 참조할 수 있도록 등록 가능한 모든 노드의 딕셔너리를 반환합니다.
    """
    return {
        "LTM_Search": LTMSearchNode(),
        "Fetch_Ext_Data": FetchExtDataNode(),
        "Pre_Fact_Check": PreFactCheckNode(),
        "LLM_Generate": LLMGenerateNode(),
        "Persist_DB": PersistDBNode(),
        "Test_Error": TestErrorNode()
    }