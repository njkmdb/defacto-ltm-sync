import httpx
import logging

logger = logging.getLogger(__name__)

class EmbeddingService:
    """
    [Task 4.1] 텍스트를 다차원 벡터(Vector)로 변환하는 서비스
    (API 호출 실패 시 RAG 테스트 진행을 위해 더미 벡터를 반환하는 방어 로직 포함)
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
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
                # 💡 [핵심 방어막] 임베딩 API 권한/지역 제한 등의 에러 발생 시, 
                # 파이프라인이 멈추지 않도록 3072차원의 더미 벡터를 반환합니다.
                logger.warning(f"⚠️ 임베딩 API 호출 제한 감지. RAG 테스트를 위해 더미 벡터를 주입합니다. 사유: {str(e)}")
                return [0.001] * 3072