from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional

class BulkSynthesizeRequest(BaseModel):
    reference_date: date
    pipeline_id: Optional[str] = Field(None, description="동적 파이프라인 설계도 ID (없으면 기본 라우팅)")

class BulkSynthesizeResponse(BaseModel):
    job_id: str
    total_count: int

class BatchJobStatusResponse(BaseModel):
    job_id: str
    status: str
    total_count: int
    current_count: int
    error_log: Optional[str] = None

class ForceSyncResponse(BaseModel):
    status: str
    message: str

class ExtSyncHistoryItem(BaseModel):
    sync_id: int
    sync_type: str
    status: str
    records_fetched: int
    error_message: Optional[str] = None
    start_ts: datetime
    end_ts: Optional[datetime] = None
    up_ts: datetime
    ne_ts: datetime

class UpdateIntervalRequest(BaseModel):
    minutes: int = Field(10, ge=1, description="변경할 스케줄러 주기 (분)")
    is_paused: bool = Field(False, description="스케줄러 일시정지 여부")