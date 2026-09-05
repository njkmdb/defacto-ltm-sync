from pydantic import BaseModel, Field
from typing import Literal

class GuideBotSchema(BaseModel):
    answer: str = Field(..., description="사용자의 질의나 요청에 대한 친절한 답변 (다국어 지원)")
    action_code: Literal["NONE", "NAVIGATE", "HIGHLIGHT"] = Field(
        "NONE", 
        description="시스템 UI 제어를 위한 액션 코드. 단순 질문은 NONE, 화면 이동이 필요하면 NAVIGATE."
    )
    target_menu: Literal["NONE", "DASHBOARD", "BUILDER", "ARCHIVE", "DOMAIN", "MEMORY", "STUDIO", "SYSTEM"] = Field(
        "NONE", 
        description="action_code가 NAVIGATE일 경우 이동할 대상 메뉴의 고유 식별자."
    )

class ChatRequest(BaseModel):
    session_id: str = Field(..., description="브라우저 sessionStorage에서 관리되는 유저 고유 대화 식별자")
    user_message: str = Field(..., description="사용자가 채팅창에 입력한 원본 메시지")
    base_entity_id: int = Field(1024, description="테넌트 식별용 주체 ID")