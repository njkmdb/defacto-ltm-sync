from datetime import date
from decimal import Decimal
from typing import List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from database.models import EventMemory, MstEntity, MstPrompt
from services.embedding_service import EmbeddingService
from services.prompt_manager import (
    DEFAULT_PROMPTS,
    HierarchicalFactSchema,
    get_dynamic_prompt,
)
from services.retrieval.bigquery_service import BigQueryRetrievalService
from services.retrieval.local_vector_service import LocalVectorRetrievalService
from services.system_service import get_system_config, get_tables


class DummyDistanceRow:
    def __init__(self, memory: EventMemory, distance: float) -> None:
        self.EventMemory = memory
        self.distance = distance


class TestExistingPromptManagerHierarchy:
    """기존 prompt_manager.py의 계층형 프롬프트 선택(ENTITY_ID -> ENTITY_TYPE -> GLOBAL -> Fallback) 검증."""

    def test_get_dynamic_prompt_prioritizes_entity_id_over_global(
        self, mock_db_session: MagicMock
    ) -> None:
        mock_entity = MstEntity(
            entity_id=1024, entity_type="COMPANY", entity_name="Defacto HQ"
        )
        global_prompt = MstPrompt(
            prompt_id=1,
            target_type="GLOBAL",
            target_value="ALL",
            pipeline_step="A_EXTRACTION",
            schema_name="HierarchicalFactSchema",
            system_prompt="Global Extraction Prompt",
            temperature=Decimal("0.70"),
            max_length=1000,
            is_active=True,
        )
        entity_specific_prompt = MstPrompt(
            prompt_id=2,
            target_type="ENTITY_ID",
            target_value="1024",
            pipeline_step="A_EXTRACTION",
            schema_name="HierarchicalFactSchema",
            system_prompt="Tenant 1024 Custom Extraction Prompt",
            temperature=Decimal("0.10"),
            max_length=1500,
            is_active=True,
        )

        mock_entity_query = MagicMock()
        mock_entity_query.filter.return_value.first.return_value = mock_entity

        mock_prompt_query = MagicMock()
        mock_prompt_query.filter.return_value.all.return_value = [
            global_prompt,
            entity_specific_prompt,
        ]

        mock_db_session.query.side_effect = [mock_entity_query, mock_prompt_query]

        instruction, schema_cls, temp, max_len = get_dynamic_prompt(
            db=mock_db_session,
            step="A_EXTRACTION",
            entity_id=1024,
            default_schema_name="HierarchicalFactSchema",
            target_lang="Japanese",
        )

        assert "Tenant 1024 Custom Extraction Prompt" in instruction
        assert "fluent Japanese" in instruction
        assert schema_cls is HierarchicalFactSchema
        assert temp == pytest.approx(0.10)
        assert max_len == 1500

    def test_get_dynamic_prompt_falls_back_to_default_when_no_db_record(
        self, mock_db_session: MagicMock
    ) -> None:
        mock_entity_query = MagicMock()
        mock_entity_query.filter.return_value.first.return_value = None

        mock_prompt_query = MagicMock()
        mock_prompt_query.filter.return_value.all.return_value = []

        mock_db_session.query.side_effect = [mock_entity_query, mock_prompt_query]

        instruction, schema_cls, temp, max_len = get_dynamic_prompt(
            db=mock_db_session,
            step="A_EXTRACTION",
            entity_id=1024,
            default_schema_name="HierarchicalFactSchema",
            target_lang="Korean",
        )

        assert DEFAULT_PROMPTS["A_EXTRACTION"] in instruction
        assert schema_cls is HierarchicalFactSchema
        # 기본 Fallback 온도 0.2 및 길이 1000 검증
        assert temp == pytest.approx(0.2)
        assert max_len == 1000


class TestExistingRetrievalAndEmbeddingServices:
    """기존 local_vector_service.py, bigquery_service.py, embedding_service.py 검증."""

    def test_search_tier_1_cache_hit_and_miss(
        self, mock_db_session: MagicMock, sample_vector_3072: List[float]
    ) -> None:
        retriever = LocalVectorRetrievalService(db=mock_db_session)

        cached_mem = EventMemory(
            memory_id=555,
            base_entity_id=1024,
            target_entity_id=9991,
            target_object_id=0,
            event_date=date(2026, 10, 15),
            memory_type="CACHE",
            content_text="캐시된 요약 텍스트",
            core_keywords=["캐시"],
            source_event_ids=[99],
        )

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value.first.return_value = DummyDistanceRow(
            cached_mem, distance=0.08
        )
        mock_db_session.query.return_value = mock_query

        hit_res = retriever.search_tier_1_cache(
            query_embedding=sample_vector_3072,
            base_entity_id=1024,
            target_entity_id=9991,
        )
        assert len(hit_res) == 1
        assert hit_res[0]["memory_id"] == 555
        assert hit_res[0]["distance"] == pytest.approx(0.08)

        # Cache Miss 검증
        mock_query.limit.return_value.first.return_value = None
        miss_res = retriever.search_tier_1_cache(
            query_embedding=sample_vector_3072,
            base_entity_id=1024,
        )
        assert miss_res == []

    def test_save_to_tier_1_cache_persists_record(
        self, mock_db_session: MagicMock, sample_vector_3072: List[float]
    ) -> None:
        retriever = LocalVectorRetrievalService(db=mock_db_session)
        saved = retriever.save_to_tier_1_cache(
            content_text="신규 캐시 엔트리",
            embedding=sample_vector_3072,
            event_date=date(2026, 10, 15),
            source_event_ids=[101, 102],
            core_keywords=["캐시", "테스트"],
            base_entity_id=1024,
            target_entity_id=9991,
            target_object_id=0,
        )

        assert saved.memory_type == "CACHE"
        assert saved.base_entity_id == 1024
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()

    def test_bigquery_service_parses_json_strings_from_dwh(
        self, sample_vector_3072: List[float]
    ) -> None:
        bq_service = BigQueryRetrievalService()
        bq_service.use_bq = True
        bq_service.project_id = "test-gcp-proj"

        fake_row = {
            "memory_id": 8001,
            "content_text": "BigQuery 아카이브 기억",
            "source_event_ids": "[301, 302]",
            "core_keywords": '["DWH", "BigQuery"]',
            "distance": 0.14,
        }
        mock_client = MagicMock()
        mock_client.query.return_value.result.return_value = [fake_row]
        bq_service.bq_client = mock_client

        results = bq_service.search_tier_3_dwh(
            query_embedding=sample_vector_3072,
            reference_date=date(2026, 10, 15),
            base_entity_id=1024,
            target_entity_id=9991,
            top_k=3,
        )

        assert len(results) == 1
        assert results[0]["memory_id"] == 8001
        assert results[0]["source_event_ids"] == [301, 302]
        assert results[0]["core_keywords"] == ["DWH", "BigQuery"]

    @pytest.mark.asyncio
    async def test_embedding_service_returns_3072_dummy_vector_on_api_failure(
        self,
    ) -> None:
        with patch(
            "services.embedding_service.get_dynamic_settings",
            return_value={"GEMINI_API_KEY": "dummy"},
        ), patch(
            "httpx.AsyncClient.post",
            new_callable=AsyncMock,
            side_effect=RuntimeError("API rate limit"),
        ):
            service = EmbeddingService(api_key="dummy")
            vec = await service.get_embedding("임베딩 폴백 테스트")
            assert len(vec) == 3072
            assert vec[0] == pytest.approx(0.001)


class TestExistingSystemServiceSecurity:
    """기존 system_service.py의 스키마 화이트리스트(ALLOWED_SCHEMAS) 보안 검증."""

    def test_get_tables_rejects_unauthorized_schema(
        self, mock_db_session: MagicMock
    ) -> None:
        with pytest.raises(HTTPException) as exc_info:
            get_tables(schema_name="pg_catalog", db=mock_db_session)
        assert exc_info.value.status_code == 400
        assert "허용되지 않은 스키마" in str(exc_info.value.detail)

    def test_get_system_config_reads_env_flag(self) -> None:
        with patch.dict("os.environ", {"USE_BIGQUERY": "True"}, clear=False):
            cfg = get_system_config()
            assert cfg["status"] == "success"
            assert cfg["use_bigquery"] is True