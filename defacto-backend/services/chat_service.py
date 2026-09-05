import os
import logging
from fastapi import HTTPException
from schemas.chat_schemas import ChatRequest, GuideBotSchema
from services.lrse_client import LRSEClient
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LRSE_URL = os.getenv("LRSE_URL", "http://127.0.0.1:8080")
SESSION_SECRET = os.getenv("SESSION_SECRET", "default_secret")

async def process_chat_message(request: ChatRequest, target_lang: str = "Korean") -> dict:
    try:
        lrse_client = LRSEClient(
            lrse_url=LRSE_URL, 
            session_id=request.session_id, 
            session_secret=SESSION_SECRET
        )

        system_instruction = (
            "당신은 Defacto LTM-Sync 시스템의 친절한 가이드 봇입니다. "
            "사용자가 시스템 사용법을 묻거나 화면 이동을 원할 때 정확하게 안내해야 합니다.\n\n"
            "[메뉴 가이드]\n"
            "- DASHBOARD: 파이프라인 관제, 통계, 미디어 파일 업로드\n"
            "- BUILDER: 파이프라인 스튜디오, 노드 조립, 프롬프트 랩\n"
            "- ARCHIVE: 일지 보관소, AI 심층 요약 리포트 열람\n"
            "- DOMAIN: 데이터 딕셔너리, 마스터 관리\n"
            "- MEMORY: 기억 탐색기, 벡터 검색\n"
            "- STUDIO: 창작 스튜디오, 2차 창작 워크스페이스\n"
            "- SYSTEM: 시스템 데이터 탐색기 (Read-Only DB 브라우저)\n\n"
            "사용자가 특정 메뉴로 이동하고 싶어하는 의도가 파악되면 action_code를 'NAVIGATE'로, "
            "target_menu를 해당 메뉴 식별자로 설정하세요. 단순 질문이면 action_code는 'NONE'으로 둡니다. "
            f"반드시 모든 텍스트 응답(answer)은 {target_lang} 언어로 작성하십시오."
        )

        result = await lrse_client.extract_fact(
            raw_content=f"User Message: {request.user_message}",
            target_schema_cls=GuideBotSchema,
            system_instruction=system_instruction,
            temperature=0.2, 
            max_tokens=600
        )

        return {
            "status": "success", 
            "data": result.model_dump()
        }

    except Exception as e:
        logger.error(f"Chatbot Processing Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"챗봇 응답 생성 실패: {str(e)}")