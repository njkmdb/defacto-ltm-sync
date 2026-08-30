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
    ref_entity_id_1: Optional[int] = Field(None, description="Derived target entity/client ID (null if none)")
    fact_content: str = Field(..., description="100% pure fact original text, perfectly refined and typo-corrected")
    attributes: Dict[str, Any] = Field(default_factory=dict, description="Structured Key-Value metadata such as amounts, items, etc.")
    content_text: str = Field(..., description="Ultra-compressed summary text within 3 to 4 lines (for fast Index scanning)")
    core_keywords: List[str] = Field(default_factory=list, description="Core keyword array for query augmentation (e.g., ['price reduction', 'claim'])")

class EventBriefingSchema(BaseModel):
    executive_summary: str = Field(..., description="Final fact-based overall summary responding to the user's query")
    key_findings: List[str] = Field(default_factory=list, description="List of key discovered facts related to the query")
    risk_and_warnings: List[str] = Field(default_factory=list, description="Contradictions between facts, potential omissions, or warnings (CRITICAL)")
    recommended_actions: List[str] = Field(default_factory=list, description="List of recommended future action guidelines")

SCHEMA_REGISTRY = {
    "HierarchicalFactSchema": HierarchicalFactSchema,
    "EventBriefingSchema": EventBriefingSchema,
    "ContextSynthesisSchema": ContextSynthesisSchema,
    "AgentPlanningSchema": AgentPlanningSchema,
    "CreativeContentSchema": CreativeContentSchema,
    "MetaPromptSchema": MetaPromptSchema,
    "FactCheckSchema": FactCheckSchema
}

# 💡 [핵심 개선] B_SYNTHESIS 기본 프롬프트에 조건부 예외 처리(IF empty, SKIP) 완벽 적용
DEFAULT_PROMPTS = {
    "A_EXTRACTION": "You are an elite AI data engineer. Based on the provided unstructured text and [Reference Master Data], perfectly extract and output the typo-corrected original text (fact_content), attributes, ultra-compressed summary (content_text), and keyword array (core_keywords) simultaneously. If the mentioned entity exists in the reference master data, map it precisely to ref_entity_id_1.\n[★ CRITICAL CONSTRAINT ★] If a '[System Auto-Correction]' tag exists at the bottom of the text, it represents the 'Absolute Truth' verified through ERP cross-validation. You MUST completely ignore any conflicting content in the original text and prioritize extracting and reflecting the figures and facts explicitly stated in this tag as the top priority.",
    "B_PLANNING": "You are an autonomous AI data agent that searches for necessary data. Read the 'target entity ID' and external data in the provided [Index Summary], and if you determine that more specific fact texts (FETCH_FACT_DETAILS) or master information of the entity/object (FETCH_ENTITY_MASTER, FETCH_OBJECT_MASTER) are needed to write the final report, call the provided Tools. If the summary alone is sufficient, use the SUFFICIENT_INFO tool.",
    "B_FACT_CHECK": "You are a ruthless and merciless Data Auditor.\nPerfectly cross-validate the numbers, dates, and facts between the [Unstructured Memory (LTM)] text and the [EXT External Structured Data (ERP/CRM)]. The EXT data is the unconditional 'Ground Truth'.\nIf there is even a single contradiction in the unstructured memory that conflicts with the EXT data by a single cent or a single day, set `has_conflict` to true and extract the detailed breakdown into the `discrepancies` array.\nAt this time, you MUST record the original raw_id of the erroneous LTM into `source_raw_id`.",
    "B_SYNTHESIS": "You are an outstanding assistant. You have been provided with the [Index Summary], [Agent Retrieved Data], and [External Structured Data].\n[CRITICAL CONSTRAINTS]\n1. IF [External Structured Data] or past memories (LTM) are provided, cross-validate the qualitative flow of the fact text with them and explain the historical continuity.\n2. IF they are empty or missing, SKIP the cross-validation and simply synthesize a professional business log based ONLY on the provided facts for today.\n3. Derive new insights and write the final summary (llm_summary). Based on the validation or synthesis, you MUST include specific practical guidelines in the action_items field. You must use ONLY the provided information without any hallucination.",
    "C_PLANNING": "You are an autonomous AI data agent that searches for necessary data. Read the 'target entity ID' and external data in the provided [Index Summary], and if you determine that more specific fact texts (FETCH_FACT_DETAILS) or master information of the target (FETCH_ENTITY_MASTER, FETCH_OBJECT_MASTER) are needed to write a professional summary report, call the provided Tools and pass the target ID arrays. If sufficient, return SUFFICIENT_INFO.",
    "C_BRIEFING": "You are an assistant summarizer who relies 100% ONLY on the provided [Detailed Fact Text], [Master Data], and [External Structured Data]. Cross-validate if the qualitative flow of the fact text matches the figures in the structured data. NEVER invent content not present in the original text (No Hallucination). If there are contradictions between facts or insufficient information, you MUST specify this in the `risk_and_warnings` field. Based on the validation results, you MUST include specific practical guidelines in the `recommended_actions` field, such as 'prepare invoice processing' or 'renegotiate unit price'.",
    "C_CREATIVE": "You are a professional AI copywriter. Based on the provided [Original Fact Data], write a secondary creative content tailored to the [Tone & Manner] specified by the user. When writing, you MUST preserve 100% of the core facts of the original text, and DO NOT distort or invent non-existent facts. If the facts are perfectly preserved as a result of the verification, return fact_preservation_check as true."
}

def get_dynamic_prompt(db: Session, step: str, entity_id: int, default_schema_name: str, target_lang: str = "Korean") -> tuple[str, Any, float, int]:
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
                
    default_prompt = DEFAULT_PROMPTS.get(step, "No default prompt configured.")
    
    if selected:
        schema_cls = SCHEMA_REGISTRY.get(selected.schema_name)
        if not schema_cls:
            logger.warning(f"[Schema Fallback] '{selected.schema_name}' 스키마를 찾을 수 없어 '{default_schema_name}'로 대체합니다.")
            schema_cls = SCHEMA_REGISTRY[default_schema_name]
        
        base_instruction = selected.system_prompt 
        temperature = float(selected.temperature) if selected.temperature is not None else 0.7 
        max_length = int(selected.max_length) if selected.max_length is not None else 1000
    else:
        logger.info(f"[Prompt Fallback] '{step}' 단계의 활성 프롬프트를 찾을 수 없어 하드코딩된 기본 프롬프트를 사용합니다.")
        base_instruction = default_prompt
        schema_cls = SCHEMA_REGISTRY[default_schema_name]
        # 💡 [개선] 팩트 기반 요약의 정밀도를 위해 기본 디폴트 온도를 0.2로 하향 조정
        temperature = 0.2 
        max_length = 1000

    global_i18n_rule = f"""<ROLE>You are an expert AI Assistant operating in a global B2B environment.</ROLE>
<PROCESS>Think, reason, and validate all facts strictly in ENGLISH using your latent space.</PROCESS>
<OUTPUT>You MUST output all final string values within the JSON response in fluent {target_lang}. DO NOT translate keys or schema structures.</OUTPUT>"""

    final_instruction = f"{global_i18n_rule}\n\n{base_instruction}"

    return final_instruction, schema_cls, temperature, max_length