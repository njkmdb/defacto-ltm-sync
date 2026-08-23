import httpx
import logging
from pydantic import BaseModel
from typing import Type, TypeVar, Any
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

T = TypeVar('T', bound=BaseModel)
logger = logging.getLogger(__name__)

class LRSEClient:
    """
    [Task 3.1] LRSE 미들웨어 연동 클라이언트
    OpenAI/Anthropic API를 직접 호출하지 않고, LRSE 서버와 통신하여 팩트를 구조화합니다.
    """
    def __init__(self, lrse_url: str, session_id: str, session_secret: str, api_key: str, model_name: str = "gemini-1.5-pro"):
        self.lrse_url = lrse_url.rstrip("/")
        self.session_id = session_id
        self.session_secret = session_secret
        self.api_key = api_key
        self.model_name = model_name

        self.headers = {
            "x-gemini-api-key": self.api_key,
            "x-model-name": self.model_name,
            "x-session-secret": self.session_secret,
            "Content-Type": "application/json"
        }

    async def _inject_dynamic_schema(self, schema_cls: Type[T]) -> None:
        """
        [Task 3.2] 동적 스키마 주입 (Seed Injection)
        LRSE의 /init 엔드포인트에 도메인 Pydantic 모델의 JSON 스키마를 사전 주입합니다.
        """
        endpoint = f"{self.lrse_url}/api/v1/session/init"
        schema_name = schema_cls.__name__
        
        schema_dict = schema_cls.model_json_schema()

        def _clean_schema_for_gemini(schema_obj):
            if isinstance(schema_obj, dict):
                schema_obj.pop("additionalProperties", None)
                schema_obj.pop("title", None)
                schema_obj.pop("default", None)
                
                for key, value in list(schema_obj.items()):
                    schema_obj[key] = _clean_schema_for_gemini(value)
            elif isinstance(schema_obj, list):
                for i in range(len(schema_obj)):
                    schema_obj[i] = _clean_schema_for_gemini(schema_obj[i])
            return schema_obj

        safe_schema_dict = _clean_schema_for_gemini(schema_dict)

        payload = {
            "session_id": self.session_id,
            "session_secret": self.session_secret,
            "api_key": self.api_key,
            "model_name": self.model_name,
            "custom_seed": [
                {
                    "id": schema_name,
                    "type": "schema",
                    "attributes": safe_schema_dict,
                    "tags": ["defacto", "domain_schema"]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(endpoint, json=payload, timeout=10.0)
                response.raise_for_status()
                logger.info(f"✅ 스키마 주입 성공: {schema_name}")
            except httpx.HTTPStatusError as e:
                err_detail = e.response.text
                logger.error(f"❌ 스키마 주입 실패 ({e.response.status_code}): {err_detail}")
                raise Exception(f"LRSE Init Error: {err_detail}")
            except Exception as e:
                logger.error(f"❌ LRSE 서버 통신 오류 (Init): {str(e)}")
                raise

    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException))
    )
    async def extract_fact(self, raw_content: str, target_schema_cls: Type[T], system_instruction: str = "", temperature: float = 0.0, max_tokens: int = None) -> T:
        """
        [Task 3.2] RPC 호출 (JSON 강제화 위임)
        비정형 텍스트를 전송하여 완벽한 Pydantic 인스턴스로 변환받아 반환합니다.
        """
        await self._inject_dynamic_schema(target_schema_cls)

        schema_name = target_schema_cls.__name__
        endpoint = f"{self.lrse_url}/api/v1/rpc/call"

        payload = {
            "context_payload": raw_content,
            "schema_name": schema_name,
            "system_instruction": system_instruction,
            "temperature": temperature
        }
        
        # 💡 [추가] LLM 토큰 물리적 제한 주입
        if max_tokens:
            payload["max_output_tokens"] = max_tokens

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    endpoint,
                    params={"session_id": self.session_id},
                    headers=self.headers,
                    json=payload,
                    timeout=60.0 
                )
                response.raise_for_status()
                
                response_data = response.json()
                validated_json = response_data.get("validated_data", {})
                
                return target_schema_cls.model_validate(validated_json)

            except httpx.HTTPStatusError as e:
                err_detail = e.response.text
                logger.error(f"❌ 팩트 구조화 실패 ({e.response.status_code}): {err_detail}")
                raise Exception(f"LRSE RPC Error: {err_detail}")
            except Exception as e:
                logger.error(f"❌ LRSE 서버 통신 오류 (RPC): {str(e)}")
                raise