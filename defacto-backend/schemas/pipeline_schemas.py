from datetime import date
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from .common_schemas import ActionItem, PaginationMeta

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