import logging
from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from database.models import MstEntity, MstPrompt
from schemas.api_schemas import ContextSynthesisSchema, AgentPlanningSchema, FactCheckSchema
from schemas.creative_schemas import CreativeContentSchema, MetaPromptSchema

logger = logging.getLogger(__name__)

class HierarchicalFactSchema(BaseModel):
    ref_entity_id_1: Optional[int] = Field(None, description="도출된 타겟 주체/거래처 ID (없으면 null)")
    fact_content: str = Field(..., description="오탈자가 교정되고 완벽히 정제된 순도 100%의 팩트 원문 줄글")
    attributes: Dict[str, Any] = Field(default_factory=dict, description="금액, 품목 등 구조화된 Key-Value 메타데이터")
    content_text: str = Field(..., description="3~4줄 이내의 초압축 요약 텍스트 (빠른 Index 스캔용)")
    core_keywords: List[str] = Field(default_factory=list, description="쿼리 증강을 위한 핵심 키워드 배열 (예: ['단가 인하', '클레임'])")

class EventBriefingSchema(BaseModel):
    executive_summary: str = Field(..., description="사용자 질의에 대한 팩트 기반의 최종 총평")
    key_findings: List[str] = Field(default_factory=list, description="질의와 관련된 주요 발견 팩트 리스트")
    risk_and_warnings: List[str] = Field(default_factory=list, description="팩트 간의 모순, 누락 가능성 또는 경고 사항 (매우 중요)")
    recommended_actions: List[str] = Field(default_factory=list, description="향후 권고 행동 지침 리스트")

# 💡 [Phase 2 & Fact Check] 스키마 레지스트리
SCHEMA_REGISTRY = {
    "HierarchicalFactSchema": HierarchicalFactSchema,
    "EventBriefingSchema": EventBriefingSchema,
    "ContextSynthesisSchema": ContextSynthesisSchema,
    "AgentPlanningSchema": AgentPlanningSchema,
    "CreativeContentSchema": CreativeContentSchema,
    "MetaPromptSchema": MetaPromptSchema,
    "FactCheckSchema": FactCheckSchema
}

# 💡 [CRITICAL] A_EXTRACTION 및 B_FACT_CHECK 프롬프트 업데이트
DEFAULT_PROMPTS = {
    "A_EXTRACTION": "당신은 뛰어난 AI 데이터 엔지니어입니다. 주어진 비정형 텍스트와 [참고 마스터 데이터]를 바탕으로, 오탈자 교정 원문(fact_content), 속성(attributes), 초압축 요약(content_text), 키워드 배열(core_keywords)을 동시에 완벽하게 추출하세요. 언급된 주체가 참고 마스터 데이터에 존재하면 ref_entity_id_1에 매핑하십시오.\n[★ 중요 제약사항 ★] 텍스트 최하단에 '[System Auto-Correction]' 태그가 존재할 경우, 이는 ERP 교차 검증을 거친 '절대 진리'입니다. 원본 텍스트의 상충하는 내용을 완전히 무시하고, 반드시 이 태그에 명시된 수치와 사실을 1순위로 우선하여 추출 및 반영하십시오.",
    "B_PLANNING": "당신은 스스로 필요한 데이터를 탐색하는 AI 데이터 에이전트입니다. 제공된 [Index 요약본] 내의 '타겟 주체 ID' 및 외부 데이터를 읽고, 최종 보고서 작성을 위해 더 구체적인 팩트 원문(FETCH_FACT_DETAILS)이나 해당 주체/객체의 마스터 정보(FETCH_ENTITY_MASTER, FETCH_OBJECT_MASTER)가 필요하다고 판단되면 제공된 Tool을 호출하십시오. 요약본만으로 정보가 충분하다면 SUFFICIENT_INFO 도구를 사용하십시오.",
    "B_FACT_CHECK": "당신은 피도 눈물도 없는 무자비한 데이터 감사관(Auditor)입니다.\n[비정형 기억(LTM)] 텍스트와 [EXT 외부 정형 데이터(ERP/CRM)]의 수치, 날짜, 사실을 완벽히 교차 검증하십시오. EXT 데이터는 무조건적인 '절대 진리(Ground Truth)'입니다. \n비정형 기억에서 단 1원, 단 하루라도 EXT 데이터와 상충하는 모순이 있다면 `has_conflict`를 true로 설정하고 `discrepancies` 배열에 상세 내역을 추출하십시오. \n이때, 해당 오류 LTM의 원천 아이디인 [원본 raw_id]를 `source_raw_id`에 반드시 기록하십시오.",
    "B_SYNTHESIS": "당신은 뛰어난 비서입니다. 당신은 [Index 요약본], [에이전트 인출 데이터], 그리고 [외부 정형 데이터]를 모두 제공받았습니다. 해당 주체와의 이력 연속성을 설명하고, 팩트 원문의 정성적 흐름과 정형 데이터의 수치가 일치하는지 교차 검증하여 새로운 인사이트를 도출하고 최종 요약본(llm_summary)을 작성하십시오. 검증 결과를 바탕으로 action_items 필드에 '송장 처리 준비', '단가 재협상'과 같은 구체적인 실무 지침을 반드시 포함하십시오. 환각 없이 오직 제공된 정보만 사용해야 합니다.",
    "C_PLANNING": "당신은 스스로 필요한 데이터를 탐색하는 AI 데이터 에이전트입니다. 제공된 [Index 요약본] 내의 '타겟 주체 ID' 및 외부 데이터를 읽고, 전문 요약 리포트 작성을 위해 더 구체적인 팩트 원문(FETCH_FACT_DETAILS)이나 해당 주체의 마스터 정보(FETCH_ENTITY_MASTER, FETCH_OBJECT_MASTER)가 필요하다고 판단되면 제공된 Tool을 호출하여 타겟 ID 배열을 넘기십시오. 충분하다면 SUFFICIENT_INFO를 반환하십시오.",
    "C_BRIEFING": "당신은 제공된 [상세 팩트 원문], [마스터 데이터] 및 [외부 정형 데이터]만을 100% 근거로 삼는 보조 요약가입니다. 팩트 원문의 정성적 흐름과 정형 데이터의 수치가 일치하는지 교차 검증하십시오. 원문에 없는 내용은 절대 지어내지 마시고(No Hallucination), 만약 팩트 간의 모순이 있거나 정보가 부족하다면 반드시 `risk_and_warnings` 필드에 해당 사실을 명시하십시오. 검증 결과를 바탕으로 `recommended_actions` 필드에 '송장 처리 준비', '단가 재협상'과 같은 구체적인 실무 지침을 반드시 포함하십시오.",
    "C_CREATIVE": "당신은 전문적인 AI 카피라이터입니다. 사용자가 지정한 [톤앤매너]에 맞춰, 제공된 [원본 팩트 데이터]를 바탕으로 2차 창작물을 작성하십시오. 작성 시 원본의 핵심 사실을 100% 보존해야 하며, 왜곡하거나 없는 사실을 지어내지 마십시오. 검증 결과 팩트가 완벽히 보존되었다면 fact_preservation_check를 true로 반환하십시오."
}

def get_dynamic_prompt(db: Session, step: str, entity_id: int, default_schema_name: str) -> tuple[str, Any, float, int]:
    entity = db.query(MstEntity).filter(MstEntity.entity_id == entity_id).first()
    entity_type = entity.entity_type if entity else "UNKNOWN"
    
    prompts = db.query(MstPrompt).filter(
        MstPrompt.pipeline_step == step,
        MstPrompt.is_active == True,
        or_(
            and_(MstPrompt.target_type == 'ENTITY_ID', MstPrompt.target_value == str(entity_id)),
            and_(MstPrompt.target_type == 'ENTITY_TYPE', MstPrompt.target_value == entity_type),
            and_(MstPrompt.target_type == 'GLOBAL', MstPrompt.target_value == 'ALL')
        )
    ).all()
    
    selected = None
    for p in prompts:
        if p.target_type == 'ENTITY_ID' and p.target_value == str(entity_id):
            selected = p
            break
            
    if not selected:
        for p in prompts:
            if p.target_type == 'ENTITY_TYPE' and p.target_value == entity_type:
                selected = p
                break
                
    if not selected:
        for p in prompts:
            if p.target_type == 'GLOBAL' and p.target_value == 'ALL':
                selected = p
                break
                
    default_prompt = DEFAULT_PROMPTS.get(step, "기본 프롬프트가 설정되지 않았습니다.")
    
    if selected:
        schema_cls = SCHEMA_REGISTRY.get(selected.schema_name)
        if not schema_cls:
            logger.warning(f"[Schema Fallback] '{selected.schema_name}' 스키마를 찾을 수 없어 '{default_schema_name}'로 대체합니다.")
            schema_cls = SCHEMA_REGISTRY[default_schema_name]
        
        return (
            selected.system_prompt, 
            schema_cls, 
            float(selected.temperature) if selected.temperature is not None else 0.7, 
            int(selected.max_length) if selected.max_length is not None else 1000
        )
    else:
        logger.info(f"[Prompt Fallback] '{step}' 단계의 활성 프롬프트를 찾을 수 없어 하드코딩된 기본 프롬프트를 사용합니다.")
        return default_prompt, SCHEMA_REGISTRY[default_schema_name], 0.7, 1000