from datetime import date
from pydantic import BaseModel, Field
from typing import List, Optional
from .common_schemas import ActionItem, PaginationMeta

class CreateRawEventRequest(BaseModel):
    base_entity_id: int = Field(..., description="타겟 엔티티 ID")
    event_date: date = Field(..., description="이벤트 발생 일자")
    raw_content: str = Field(..., min_length=1, description="수동 입력할 비정형 원본 텍스트")
    run_pipeline_now: bool = Field(False, description="저장 직후 파이프라인 즉시 가동 여부")
    schema_name: str = Field("HierarchicalFactSchema", description="구조화할 타겟 스키마명")

class UpdateRawEventRequest(BaseModel):
    base_entity_id: Optional[int] = Field(None, description="교정할 주체 ID") 
    event_date: date = Field(..., description="수정된 이벤트 발생 일자")
    raw_content: str = Field(..., min_length=1, description="오류 교정 등 수정된 원본 텍스트")
    run_pipeline_now: bool = Field(False, description="수정 직후 파이프라인 즉시 가동 여부")
    schema_name: str = Field("HierarchicalFactSchema", description="구조화할 타겟 스키마명")

class RawEventResponse(BaseModel):
    status: str
    message: str
    raw_id: Optional[int] = None

class BulkDeleteRequest(BaseModel):
    raw_ids: List[int] = Field(..., description="일괄 삭제할 Raw ID 목록")

class BulkDeleteLogRequest(BaseModel):
    log_ids: List[int] = Field(..., description="일괄 삭제할 로그 ID 목록")

class EventLogItem(BaseModel):
    log_id: int
    base_entity_id: int
    log_date: date
    llm_summary: str
    action_items: List[ActionItem] = []

class EventLogListResponse(BaseModel):
    status: str
    data: List[EventLogItem]
    meta: PaginationMeta

class UpsertEventLogItem(BaseModel):
    log_id: Optional[int] = None
    base_entity_id: int
    log_date: date
    llm_summary: str
    action_items: List[ActionItem] = []

class BulkUpsertLogRequest(BaseModel):
    items: List[UpsertEventLogItem]