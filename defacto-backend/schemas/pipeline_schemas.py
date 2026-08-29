from datetime import date
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any
from .common_schemas import ActionItem, PaginationMeta

# --- [Feature 1] Impact Analysis Schemas ---
class ImpactedItem(BaseModel):
    item_type: Literal["BRIEFING", "CREATION"]
    item_id: int
    title_or_summary: str

class ImpactAnalysisResponse(BaseModel):
    status: str
    affected_count: int
    affected_items: List[ImpactedItem]

# --- [Feature 2] Pre-generation Cross-Validation Schemas ---
class DiscrepancyItem(BaseModel):
    source_raw_id: int = Field(..., description="오류를 내포한 원시 데이터의 PK ID")
    issue_topic: str = Field(..., description="충돌 주제 (예: 계약 금액, 납기일)")
    ai_memory_value: str = Field(..., description="AI 비정형 기억(LTM)에 기록된 잘못된 값")
    ext_truth_value: str = Field(..., description="ERP/CRM(EXT)에 기록된 절대 진리 값")
    recommended_correction: str = Field(..., description="시스템 자동 교정에 쓰일 제안 텍스트")

class FactCheckSchema(BaseModel):
    has_conflict: bool = Field(..., description="단 하나의 모순이라도 존재하면 True")
    discrepancies: List[DiscrepancyItem] = Field(default_factory=list)

class FactCheckRequest(BaseModel):
    base_entity_id: int
    reference_date: str

# --- 기존 Schemas ---
class StructureEventsRequest(BaseModel):
    base_entity_id: int
    target_raw_ids: List[int]
    schema_name: str
    retry_failed: bool = False

class StructureEventResult(BaseModel):
    raw_id: int
    sync_status_id: int
    event_id: Optional[int] = None
    error_reason: Optional[str] = None

class StructureEventsResponse(BaseModel):
    status: str
    message: str
    results: List[StructureEventResult]

class RawDataStatus(BaseModel):
    raw_id: int
    base_entity_id: int 
    sync_status_id: int
    event_date: date
    raw_content: str
    error_log: Optional[str] = None

class PipelineStatusResponse(BaseModel):
    total_count: int
    success_count: int
    failed_count: int
    pending_count: int
    data_list: List[RawDataStatus]
    meta: PaginationMeta

class SynthesizeContextRequest(BaseModel):
    base_entity_id: int
    reference_date: date
    schema_name: str
    use_deep_search: bool = False

class ToolCall(BaseModel):
    tool_name: Literal["FETCH_FACT_DETAILS", "FETCH_ENTITY_MASTER", "FETCH_OBJECT_MASTER", "SUFFICIENT_INFO"] = Field(..., description="사용할 도구 이름")
    target_ids: List[int] = Field(default_factory=list, description="조회할 대상 ID 배열 (SUFFICIENT_INFO일 경우 빈 배열)")

class AgentPlanningSchema(BaseModel):
    reasoning: str = Field(..., description="어떤 정보가 부족하며 어떤 도구를 사용해야 하는지 에이전트의 추론 과정")
    tool_calls: List[ToolCall] = Field(default_factory=list, description="실행할 도구 호출 목록")

class ContextSynthesisSchema(BaseModel):
    llm_summary: str
    action_items: List[ActionItem]

class SynthesizedData(BaseModel):
    llm_summary: str
    action_items: Optional[List[ActionItem]] = []

class RagMetrics(BaseModel):
    cache_hit: bool
    memory_type_used: str

class SynthesizeContextData(BaseModel):
    log_id: int
    synthesized_data: SynthesizedData
    rag_metrics: RagMetrics

class SynthesizeContextResponse(BaseModel):
    status: str
    data: SynthesizeContextData

class SaveSummaryRequest(BaseModel):
    log_id: Optional[int] = None
    base_entity_id: int
    reference_date: date
    edited_summary: str
    action_items: List[ActionItem] = []
    schema_name: str = "LTM_Synthesis"

# --- [Sprint 1] Node Orchestration Schemas ---
class PipelineStep(BaseModel):
    step_id: str = Field(..., description="노드 고유 식별자 (예: node_ltm_search_01)")
    step_order: int = Field(..., description="실행 순서 (위상 정렬의 기준)")
    module_name: str = Field(..., description="실행할 코어 모듈명 (예: LTM_Search, Pre_Fact_Check)")
    params: Dict[str, Any] = Field(default_factory=dict, description="해당 모듈에 주입될 동적 속성 (프론트엔드 Property Editor와 매핑)")
    output_key: str = Field(..., description="이 노드의 결과물을 전역 상태(Context)에 저장할 Key 이름")

class PipelineExecutionRequest(BaseModel):
    pipeline_id: Optional[str] = Field(None, description="저장된 프리셋 설계도 ID (DB 인출용)")
    base_entity_id: int = Field(..., description="[보안 필수] 테넌트 데이터 격리를 위한 마스터 주체 ID")
    initial_context: Dict[str, Any] = Field(default_factory=dict, description="최초 주입 데이터 (raw_text, reference_date 등)")
    steps: List[PipelineStep] = Field(default_factory=list, description="실행할 노드 명세 배열")