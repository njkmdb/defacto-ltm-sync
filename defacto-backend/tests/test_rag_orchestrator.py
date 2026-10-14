import math
from datetime import date
from typing import List
from unittest.mock import MagicMock, patch

import pytest

from database.models import EventMemory
from services.rag_orchestrator import RagOrchestrator
from services.retrieval.local_vector_service import LocalVectorRetrievalService


class DummyQueryRow:
    """SQLAlchemy (EventMemory, distance) 튜플 Row 모사 클래스."""

    def __init__(self, memory: EventMemory, distance: float) -> None:
        self.EventMemory = memory
        self.distance = distance


class TestLocalVectorTimeDecayReranking:
    """Tier 2 로컬 pgvector 검색의 시간 감쇠(Time Decay) 수식 및 재정렬 검증."""

    def test_search_tier_2_ltm_applies_logarithmic_time_decay(
        self, mock_db_session: MagicMock, sample_vector_3072: List[float]
    ) -> None:
        ref_date = date(2026, 10, 15)

        # 오래된 기억(100일 전): 순수 코사인 거리는 0.20으로 더 가깝지만 시간 감쇠 패널티가 큼
        old_memory = EventMemory(
            memory_id=1,
            base_entity_id=1024,
            target_entity_id=9991,
            target_object_id=0,
            event_date=date(2026, 7, 7),  # 100 days before 2026-10-15
            memory_type="LTM",
            content_text="100일 전 구형 단가 협의",
            core_keywords=["구형"],
            source_event_ids=[10],
        )
        # 최신 기억(1일 전): 순수 코사인 거리는 0.25이지만 시간 감쇠 패널티가 극소함
        recent_memory = EventMemory(
            memory_id=2,
            base_entity_id=1024,
            target_entity_id=9991,
            target_object_id=0,
            event_date=date(2026, 10, 14),  # 1 day before 2026-10-15
            memory_type="LTM",
            content_text="어제 진행한 최신 단가 협의",
            core_keywords=["최신"],
            source_event_ids=[20],
        )

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value.all.return_value = [
            DummyQueryRow(old_memory, distance=0.20),
            DummyQueryRow(recent_memory, distance=0.25),
        ]
        mock_db_session.query.return_value = mock_query

        retriever = LocalVectorRetrievalService(db=mock_db_session)
        memories, best_base_distance = retriever.search_tier_2_ltm(
            query_embedding=sample_vector_3072,
            reference_date=ref_date,
            base_entity_id=1024,
            target_entity_id=9991,
            top_k=2,
        )

        # 1. best_base_distance는 시간 감쇠 적용 전 최상위 순수 시맨틱 거리(0.20)를 유지해야 함
        assert best_base_distance == pytest.approx(0.20)

        # 2. 시간 감쇠 수식(base_distance + math.log1p(days) * 0.02)에 의해 최신 기억(id=2)이 1순위로 역전되어야 함
        expected_old_adj = 0.20 + math.log1p(100) * 0.02  # ~0.2923
        expected_recent_adj = 0.25 + math.log1p(1) * 0.02  # ~0.2638

        assert memories[0]["memory_id"] == 2
        assert memories[0]["adjusted_distance"] == pytest.approx(expected_recent_adj)
        assert memories[1]["memory_id"] == 1
        assert memories[1]["adjusted_distance"] == pytest.approx(expected_old_adj)


class TestRagOrchestratorRoutingAndIsolation:
    """3-Tier 라우팅(Cache -> LTM -> BigQuery) 및 Dual-Track 멀티테넌트 격리 검증."""

    def test_tier_1_cache_hit_short_circuits_lower_tiers(
        self, mock_db_session: MagicMock, sample_vector_3072: List[float]
    ) -> None:
        orchestrator = RagOrchestrator(db=mock_db_session)
        cached_item = [
            {
                "memory_id": 777,
                "content_text": "Tier 1 캐시 적중 데이터",
                "core_keywords": ["캐시"],
                "source_event_ids": [1],
                "base_distance": 0.05,
                "adjusted_distance": 0.05,
                "distance": 0.05,
            }
        ]

        orchestrator.local_retriever.search_tier_1_cache = MagicMock(
            return_value=cached_item
        )
        orchestrator.local_retriever.search_tier_2_ltm = MagicMock()
        orchestrator.bq_retriever.search_tier_3_dwh = MagicMock()

        res = orchestrator._execute_routing_pipeline(
            query_embedding=sample_vector_3072,
            reference_date=date(2026, 10, 15),
            base_entity_id=1024,
            target_entity_id=9991,
        )

        assert res == cached_item
        orchestrator.local_retriever.search_tier_2_ltm.assert_not_called()
        orchestrator.bq_retriever.search_tier_3_dwh.assert_not_called()

    def test_fallback_to_tier_3_bigquery_when_ltm_distance_exceeds_threshold(
        self, mock_db_session: MagicMock, sample_vector_3072: List[float]
    ) -> None:
        orchestrator = RagOrchestrator(db=mock_db_session)
        orchestrator.local_retriever.search_tier_1_cache = MagicMock(return_value=[])
        # Tier 2 LTM의 best_distance가 0.45(> 0.3)로 임계값 초과 시나리오
        orchestrator.local_retriever.search_tier_2_ltm = MagicMock(
            return_value=([{"memory_id": 10, "content_text": "낮은 유사도"}], 0.45)
        )
        bq_hit = [
            {
                "memory_id": 9001,
                "content_text": "BigQuery 콜드 스토리지에서 인출된 핵심 기억",
                "core_keywords": ["BigQuery", "ColdTier"],
                "source_event_ids": [888],
                "base_distance": 0.12,
                "adjusted_distance": 0.12,
                "distance": 0.12,
            }
        ]
        orchestrator.bq_retriever.search_tier_3_dwh = MagicMock(return_value=bq_hit)
        orchestrator.local_retriever.save_to_tier_1_cache = MagicMock()

        res = orchestrator._execute_routing_pipeline(
            query_embedding=sample_vector_3072,
            reference_date=date(2026, 10, 15),
            base_entity_id=1024,
            target_entity_id=9991,
        )

        assert res == bq_hit
        orchestrator.bq_retriever.search_tier_3_dwh.assert_called_once()
        # BigQuery에서 찾은 최상위 결과를 로컬 Tier 1 캐시에 승격 저장하는지 확인
        orchestrator.local_retriever.save_to_tier_1_cache.assert_called_once_with(
            content_text="BigQuery 콜드 스토리지에서 인출된 핵심 기억",
            embedding=sample_vector_3072,
            event_date=date(2026, 10, 15),
            source_event_ids=[888],
            core_keywords=["BigQuery", "ColdTier"],
            base_entity_id=1024,
            target_entity_id=9991,
            target_object_id=0,
        )

    def test_dual_track_deduplication_and_strict_tenant_isolation(
        self, mock_db_session: MagicMock, sample_vector_3072: List[float]
    ) -> None:
        orchestrator = RagOrchestrator(db=mock_db_session)

        track1_mock_data = [
            {"memory_id": 101, "content_text": "타겟 9991 전용 기억"},
            {"memory_id": 102, "content_text": "공통 기억"},
        ]
        track2_mock_data = [
            {"memory_id": 102, "content_text": "공통 기억 (Track 2 중복)"},
            {"memory_id": 205, "content_text": "타 거래처 유사 사례 인사이트"},
        ]

        with patch.object(
            orchestrator,
            "_execute_routing_pipeline",
            side_effect=[track1_mock_data, track2_mock_data],
        ) as mock_routing:
            result = orchestrator.get_optimal_context(
                base_entity_id=1024,
                query_embedding=sample_vector_3072,
                reference_date=date(2026, 10, 15),
                target_entity_id=9991,
                target_object_id=0,
            )

            assert len(mock_routing.call_args_list) == 2
            # Track 2 호출 시에도 base_entity_id=1024가 반드시 유지되는지(멀티테넌트 보안) 검증
            track2_call_kwargs = mock_routing.call_args_list[1].kwargs
            assert track2_call_kwargs["base_entity_id"] == 1024
            assert track2_call_kwargs["target_entity_id"] == 0

            # Track 1에 이미 존재하는 memory_id=102가 Track 2에서 제거되었는지 검증
            assert [m["memory_id"] for m in result["track1"]] == [101, 102]
            assert [m["memory_id"] for m in result["track2"]] == [205]