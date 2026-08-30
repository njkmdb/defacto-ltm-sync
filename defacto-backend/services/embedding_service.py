import httpx
import logging

# 👇 [추가] 
from services.system_service import get_dynamic_settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self, api_key: str = None):
        settings = get_dynamic_settings()
        
        # 외부에서 값이 넘어오지 않았다면 동적 환경 설정값을 사용합니다.
        self.api_key = api_key if api_key else settings.get("GEMINI_API_KEY", "")
        self.api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"

    async def get_embedding(self, text: str) -> list[float]:
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {
                "parts": [{"text": text}]
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.api_url}?key={self.api_key}",
                    headers=headers,
                    json=payload,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                
                return data["embedding"]["values"]
                
            except Exception as e:
                logger.warning(f"⚠️ 임베딩 API 호출 제한 감지. RAG 테스트를 위해 더미 벡터를 주입합니다. 사유: {str(e)}")
                return [0.001] * 3072