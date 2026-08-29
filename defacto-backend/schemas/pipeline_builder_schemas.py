from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .pipeline_schemas import PipelineStep
from .common_schemas import PaginationMeta

class PipelinePresetItem(BaseModel):
    pipeline_id: str
    pipeline_name: str
    description: Optional[str] = None
    config_json: List[PipelineStep]
    is_active: bool
    up_ts: datetime
    ne_ts: datetime

class PipelinePresetListResponse(BaseModel):
    status: str
    data: List[PipelinePresetItem]
    meta: PaginationMeta

class CreatePipelinePresetRequest(BaseModel):
    pipeline_id: str = Field(..., description="고유 프리셋 영문 ID")
    pipeline_name: str = Field(..., description="프리셋 표출 이름")
    description: Optional[str] = None
    config_json: List[PipelineStep] = Field(..., description="조립된 노드 파이프라인 배열")
    is_active: bool = True

class UpdatePipelinePresetRequest(BaseModel):
    pipeline_name: str
    description: Optional[str] = None
    config_json: List[PipelineStep]
    is_active: bool

class PipelineExecutionResponse(BaseModel):
    status: str
    final_state: Dict[str, Any]