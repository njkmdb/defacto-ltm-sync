from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any, Dict
from .common_schemas import PaginationMeta

class MasterTypeListResponse(BaseModel):
    status: str
    data: List[str]

class MstStatusItem(BaseModel):
    status_id: int
    domain_category: str
    status_name: str
    attributes: Dict[str, Any] = {} # 💡 Added
    is_active: bool
    ne_ts: Optional[datetime] = None
    up_ts: Optional[datetime] = None

class MstStatusListResponse(BaseModel):
    status: str
    data: List[MstStatusItem]
    meta: PaginationMeta

class MstStatusOption(BaseModel):
    status_id: int
    status_name: str

class MstStatusOptionsResponse(BaseModel):
    status: str
    data: List[MstStatusOption]

class CreateMstStatusRequest(BaseModel):
    status_id: int = Field(..., description="명시적 상태 ID 할당")
    domain_category: str = Field(..., min_length=1)
    status_name: str = Field(..., min_length=1)
    attributes: Dict[str, Any] = {} # 💡 Added
    is_active: bool = True

class UpdateMstStatusRequest(BaseModel):
    status_id: int
    domain_category: str = Field(..., min_length=1)
    status_name: str = Field(..., min_length=1)
    attributes: Dict[str, Any] = {} # 💡 Added
    is_active: bool = True

class MstEntityItem(BaseModel):
    entity_id: int
    parent_entity_id: Optional[int] = None
    entity_type: str
    entity_name: str
    attributes: Dict[str, Any] = {}
    entity_status_id: int
    ne_ts: Optional[datetime] = None
    up_ts: Optional[datetime] = None

class MstEntityListResponse(BaseModel):
    status: str
    data: List[MstEntityItem]
    meta: PaginationMeta

class CreateMstEntityRequest(BaseModel):
    entity_id: Optional[int] = None 
    parent_entity_id: Optional[int] = None
    entity_type: str = Field(..., min_length=1)
    entity_name: str = Field(..., min_length=1)
    attributes: Dict[str, Any] = {}
    entity_status_id: Optional[int] = 1 

class UpdateMstEntityRequest(BaseModel):
    entity_id: Optional[int] = None 
    parent_entity_id: Optional[int] = None
    entity_type: str = Field(..., min_length=1)
    entity_name: str = Field(..., min_length=1)
    attributes: Dict[str, Any] = {}
    entity_status_id: Optional[int] = 1

class MstObjectItem(BaseModel):
    object_id: int
    parent_object_id: Optional[int] = None
    object_type: str
    object_name: str
    attributes: Dict[str, Any] = {}
    object_status_id: int
    ne_ts: Optional[datetime] = None
    up_ts: Optional[datetime] = None

class MstObjectListResponse(BaseModel):
    status: str
    data: List[MstObjectItem]
    meta: PaginationMeta

class CreateMstObjectRequest(BaseModel):
    object_id: Optional[int] = None 
    parent_object_id: Optional[int] = None
    object_type: str = Field(..., min_length=1)
    object_name: str = Field(..., min_length=1)
    attributes: Dict[str, Any] = {}
    object_status_id: Optional[int] = 1 

class UpdateMstObjectRequest(BaseModel):
    object_id: Optional[int] = None 
    parent_object_id: Optional[int] = None
    object_type: str = Field(..., min_length=1)
    object_name: str = Field(..., min_length=1)
    attributes: Dict[str, Any] = {}
    object_status_id: Optional[int] = 1

class BulkDeleteMasterRequest(BaseModel):
    target_ids: List[int] = Field(..., description="일괄 삭제할 마스터 ID 목록")

class BulkUpsertMstEntityRequest(BaseModel):
    items: List[CreateMstEntityRequest]

class BulkUpsertMstObjectRequest(BaseModel):
    items: List[CreateMstObjectRequest]

class BulkUpsertMstStatusRequest(BaseModel):
    items: List[CreateMstStatusRequest]

# 💡 [NEW] B_FACT_CHECK 파이프라인 단계 및 FactCheckSchema 매핑 추가
VALID_STEP_SCHEMA_MAP = {
    "A_EXTRACTION": "HierarchicalFactSchema",
    "B_PLANNING": "AgentPlanningSchema",
    "B_FACT_CHECK": "FactCheckSchema",
    "B_SYNTHESIS": "ContextSynthesisSchema",
    "C_PLANNING": "AgentPlanningSchema",
    "C_BRIEFING": "EventBriefingSchema",
    "C_CREATIVE": "CreativeContentSchema"
}

class PromptItem(BaseModel):
    prompt_id: int
    target_type: str
    target_value: str
    pipeline_step: str
    schema_name: str
    system_prompt: str
    temperature: float
    max_length: int
    is_active: bool
    up_ts: datetime
    ne_ts: datetime

class PromptListResponse(BaseModel):
    status: str
    data: List[PromptItem]
    meta: PaginationMeta

class CreatePromptRequest(BaseModel):
    target_type: str = Field(..., description="GLOBAL, ENTITY_TYPE, ENTITY_ID, TONE_PRESET")
    target_value: str = Field(..., description="ALL, COMPANY, 1024 등 (TONE_PRESET인 경우 식별자명)")
    pipeline_step: str = Field(..., description="A_EXTRACTION, B_PLANNING, B_FACT_CHECK, B_SYNTHESIS, C_PLANNING, C_BRIEFING, C_CREATIVE")
    schema_name: str = Field(..., description="매핑할 스키마 클래스명")
    system_prompt: str = Field(..., description="LLM 시스템 프롬프트")
    temperature: float = Field(0.7, description="LLM 생성 온도")
    max_length: int = Field(1000, description="목표 글자수 제한")
    is_active: bool = True

    @model_validator(mode='after')
    def validate_schema_for_step(self):
        expected_schema = VALID_STEP_SCHEMA_MAP.get(self.pipeline_step)
        if expected_schema and self.schema_name != expected_schema:
            raise ValueError(f"'{self.pipeline_step}' 단계는 반드시 '{expected_schema}' 스키마를 사용해야 합니다.")
        return self

class UpdatePromptRequest(BaseModel):
    target_type: str
    target_value: str
    pipeline_step: str
    schema_name: str
    system_prompt: str
    temperature: float
    max_length: int
    is_active: bool

    @model_validator(mode='after')
    def validate_schema_for_step(self):
        expected_schema = VALID_STEP_SCHEMA_MAP.get(self.pipeline_step)
        if expected_schema and self.schema_name != expected_schema:
            raise ValueError(f"'{self.pipeline_step}' 단계는 반드시 '{expected_schema}' 스키마를 사용해야 합니다.")
        return self