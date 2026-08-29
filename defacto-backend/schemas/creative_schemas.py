from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal, List, Optional
from .common_schemas import PaginationMeta

class CreativeContentSchema(BaseModel):
    fact_preservation_check: bool = Field(..., description="원본 팩트가 하나라도 누락/왜곡되었는지 검증 (True/False)")
    creative_title: str
    creative_content: str

class MetaPromptSchema(BaseModel):
    generated_prompt: str

class SourceItem(BaseModel):
    source_type: Literal["LOG", "BRIEFING", "CREATION"]
    source_id: int

class GenerateCreativeRequest(BaseModel):
    sources: List[SourceItem] = Field(..., description="다중 소스 처리용 배열")
    base_entity_id: int = Field(..., description="테넌트 무결성 검증을 위한 주체 ID") # 💡 테넌트 ID 필수화
    system_instruction: str
    temperature: float = Field(0.7, description="LLM 생성 온도 (0.0 ~ 1.0)")
    max_length: int = Field(1000, description="최종 결과물 목표 글자수")

class GenerateMetaPromptRequest(BaseModel):
    user_intent: str

class SaveCreativeRequest(BaseModel):
    sources: List[SourceItem]
    base_entity_id: int
    tone_name: str
    creative_title: str
    creative_content: str

class EventCreationItem(BaseModel):
    creation_id: int
    sources: List[SourceItem]
    base_entity_id: int
    tone_name: str
    creative_title: str
    creative_content: str
    ne_ts: datetime

class EventCreationListResponse(BaseModel):
    status: str
    data: List[EventCreationItem]
    meta: PaginationMeta