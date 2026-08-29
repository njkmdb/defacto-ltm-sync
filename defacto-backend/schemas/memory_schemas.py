from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import List, Optional
from .common_schemas import PaginationMeta

class MemorySearchRequest(BaseModel):
    query_text: str = Field(..., description="사용자의 자연어 검색 쿼리")
    page: int = 1
    limit: int = 20
    distance_threshold: float = Field(1.0, description="코사인 거리 임계값")
    # 💡 [CRITICAL FIX] Optional 제거 및 필수값(Required)으로 강제 변경
    base_entity_id: int = Field(..., description="테넌트 보안 검증용 주체 ID")
    search_conditions: Optional[str] = Field(None, description="다중 조건 필터 (JSON 문자열)")
    include_dwh: bool = Field(False, description="클라우드 DWH(BigQuery) 포함 검색 여부")

class MemorySearchResultItem(BaseModel):
    memory_id: int
    base_entity_id: int
    event_date: date
    memory_type: str
    content_text: str
    core_keywords: List[str] = []
    source_event_ids: List[int] = []
    base_distance: float
    adjusted_distance: float
    distance: float

class MemorySearchResponse(BaseModel):
    status: str
    data: List[MemorySearchResultItem]
    meta: PaginationMeta

class GenerateBriefingRequest(BaseModel):
    query_text: str = Field(..., description="리포트 생성을 위한 메인 질의")
    selected_memory_ids: List[int] = Field(..., description="사용자가 직접 체리피킹한 메모리 ID 배열")
    base_entity_id: int

class EventBriefingData(BaseModel):
    executive_summary: str
    key_findings: List[str]
    risk_and_warnings: List[str]
    recommended_actions: List[str]

class SaveBriefingRequest(BaseModel):
    base_entity_id: int
    query_text: str
    executive_summary: str
    key_findings: List[str]
    risk_and_warnings: List[str]
    recommended_actions: List[str]
    source_memory_ids: List[int]

class BriefingItem(BaseModel):
    briefing_id: int
    base_entity_id: int
    query_text: str
    executive_summary: str
    key_findings: List[str]
    risk_and_warnings: List[str]
    recommended_actions: List[str]
    source_memory_ids: List[int]
    up_ts: datetime
    ne_ts: datetime

class BriefingListResponse(BaseModel):
    status: str
    data: List[BriefingItem]
    meta: PaginationMeta

class AuditMemoryItem(BaseModel):
    memory_id: int
    content_text: str
    event_date: date
    source_event_ids: List[int]

class BriefingAuditTrailResponse(BaseModel):
    status: str
    data: List[AuditMemoryItem]

class UpdateBriefingRequest(BaseModel):
    base_entity_id: int = Field(..., description="테넌트 보안 검증용 주체 ID")
    query_text: str
    executive_summary: str
    key_findings: List[str]
    risk_and_warnings: List[str]
    recommended_actions: List[str]

class BulkDeleteBriefingRequest(BaseModel):
    base_entity_id: int = Field(..., description="테넌트 보안 검증용 주체 ID")
    briefing_ids: List[int]