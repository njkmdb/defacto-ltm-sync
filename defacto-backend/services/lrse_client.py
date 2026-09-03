import httpx
import logging
from pydantic import BaseModel
from typing import Type, TypeVar, Any
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from services.system_service import get_dynamic_settings

T = TypeVar('T', bound=BaseModel)
logger = logging.getLogger(__name__)

class LRSEClient:
    def __init__(self, lrse_url: str, session_id: str, session_secret: str, api_key: str = None, model_name: str = None):
        settings = get_dynamic_settings()
        
        self.lrse_url = lrse_url.rstrip("/")
        self.session_id = session_id
        self.session_secret = session_secret
        
        # 👇 [하드코딩 제거] 외부에서 값이 넘어오지 않았다면 환경 설정값(auto)을 사용합니다.
        self.api_key = api_key if api_key else settings.get("GEMINI_API_KEY", "")
        self.model_name = model_name if model_name else settings.get("MODEL_NAME", "auto")

        self.headers = {
            "x-gemini-api-key": self.api_key,
            "x-model-name": self.model_name,
            "x-session-secret": self.session_secret,
            "Content-Type": "application/json"
        }

    @retry(
        wait=wait_exponential(multiplier=2, min=4, max=60),
        stop=stop_after_attempt(5),
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TimeoutException))
    )
    async def extract_fact(self, raw_content: str, target_schema_cls: Type[T], system_instruction: str = "", temperature: float = 0.0, max_tokens: int = None) -> T:
        schema_name = target_schema_cls.__name__
        endpoint = f"{self.lrse_url}/api/v1/rpc/call"

        schema_dict = target_schema_cls.model_json_schema()

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
            "context_payload": raw_content,
            "schema_name": schema_name,
            "dynamic_schema_definition": safe_schema_dict, 
            "system_instruction": system_instruction,
            "temperature": temperature
        }
        
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
                status_code = e.response.status_code
                logger.error(f"❌ 팩트 구조화 실패 (HTTP {status_code}): {err_detail}")
                raise Exception(f"LRSE RPC Error [HTTP {status_code}]: {err_detail}")
            except Exception as e:
                logger.error(f"❌ LRSE 서버 통신 오류 (RPC): {str(e)}")
                raise