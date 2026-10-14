from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from pydantic import ValidationError

from schemas.chat_schemas import GuideBotSchema
from schemas.master_prompt_schemas import CreatePromptRequest, VALID_STEP_SCHEMA_MAP
from services.lrse_client import LRSEClient
from services.mst_status_service import validate_status_id_range
from services.prompt_manager import HierarchicalFactSchema


class TestLRSEClientRPCAndTelemetry:
    """LRSEClient의 스키마 정제, RPC 페이로드 구성 및 비동기 메트릭 로깅 검증."""

    @pytest.mark.asyncio
    async def test_extract_fact_cleans_schema_and_triggers_async_metrics(self) -> None:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"X-Correlation-ID": "corr-test-999"}
        mock_response.json.return_value = {
            "validated_data": {
                "ref_entity_id_1": 9991,
                "fact_content": "알파오메가와 단가 300만 원에 계약 체결",
                "attributes": {"amount": 3000000, "currency": "KRW"},
                "content_text": "알파오메가 300만 원 계약 체결 요약",
                "core_keywords": ["알파오메가", "계약"],
            },
            "meta": {
                "latency_ms": 420,
                "prompt_tokens": 310,
                "completion_tokens": 95,
                "total_tokens": 405,
                "retry_count": 0,
            },
        }

        with patch(
            "services.lrse_client.get_dynamic_settings",
            return_value={"GEMINI_API_KEY": "test-key", "MODEL_NAME": "gemini-2.5-flash"},
        ), patch(
            "services.lrse_client.log_metrics_async", new_callable=AsyncMock
        ) as mock_log_metrics, patch(
            "httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response
        ) as mock_post:
            client = LRSEClient(
                lrse_url="http://127.0.0.1:8081/",
                session_id="sess-01",
                session_secret="sec-01",
                base_entity_id=1024,
            )

            result = await client.extract_fact(
                raw_content="원본 텍스트",
                target_schema_cls=HierarchicalFactSchema,
                system_instruction="시스템 지시문",
                temperature=0.2,
                max_tokens=800,
            )

            # 1. 반환 객체 타입 및 필드 검증
            assert isinstance(result, HierarchicalFactSchema)
            assert result.ref_entity_id_1 == 9991
            assert result.attributes["amount"] == 3000000

            # 2. Gemini API 호환을 위해 dynamic_schema_definition에서 title, default, additionalProperties가 제거되었는지 검증
            sent_payload = mock_post.call_args.kwargs["json"]
            cleaned_schema = sent_payload["dynamic_schema_definition"]
            assert "title" not in cleaned_schema
            assert "additionalProperties" not in cleaned_schema
            for prop_val in cleaned_schema.get("properties", {}).values():
                assert "title" not in prop_val
                assert "default" not in prop_val

            # 3. 헤더에 X-Correlation-ID가 주입되었는지 검증
            sent_headers = mock_post.call_args.kwargs["headers"]
            assert "X-Correlation-ID" in sent_headers

            # 4. 비동기 메트릭 로깅 코루틴이 호출되었는지 검증
            mock_log_metrics.assert_called_once()


class TestDomainRulesAndSchemaValidators:
    """도메인 상태 코드 대역 분리 및 프롬프트-스키마 1:1 매핑 검증기 테스트."""

    @pytest.mark.parametrize(
        "step,expected_schema",
        list(VALID_STEP_SCHEMA_MAP.items()),
    )
    def test_valid_step_schema_mapping_passes(
        self, step: str, expected_schema: str
    ) -> None:
        req = CreatePromptRequest(
            target_type="GLOBAL",
            target_value="ALL",
            pipeline_step=step,
            schema_name=expected_schema,
            system_prompt="Valid prompt",
            temperature=0.2,
            max_length=1000,
            is_active=True,
        )
        assert req.schema_name == expected_schema

    def test_mismatched_step_and_schema_raises_validation_error(self) -> None:
        with pytest.raises(ValidationError, match="반드시 'HierarchicalFactSchema' 스키마를 사용"):
            CreatePromptRequest(
                target_type="GLOBAL",
                target_value="ALL",
                pipeline_step="A_EXTRACTION",
                schema_name="EventBriefingSchema",  # 잘못된 스키마 매핑
                system_prompt="Invalid mapping test",
            )

    @pytest.mark.parametrize(
        "category,valid_id,invalid_id",
        [
            ("SYSTEM", 0, 10),
            ("SYSTEM", 9, 15),
            ("ENTITY", 10, 5),
            ("ENTITY", 99, 100),
            ("OBJECT", 100, 99),
            ("TRANSACTION", 250, 300),
            ("WORKFLOW", 350, 400),
        ],
    )
    def test_status_id_band_separation_rules(
        self, category: str, valid_id: int, invalid_id: int
    ) -> None:
        # 정상 대역 통과 확인
        validate_status_id_range(valid_id, category)

        # 대역 위반 시 예외 발생 확인
        with pytest.raises(Exception, match="번호만 사용할 수 있습니다"):
            validate_status_id_range(invalid_id, category)