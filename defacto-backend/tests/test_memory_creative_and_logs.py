from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from database.models import EventBriefing, EventCreation, EventLog, EventMemory
from schemas.api_schemas import (
    ActionItem,
    GenerateBriefingRequest,
    MemorySearchRequest,
    SaveBriefingRequest,
    SaveSummaryRequest,
    UpdateBriefingRequest,
)
from schemas.creative_schemas import (
    CreativeContentSchema,
    GenerateCreativeRequest,
    GenerateMetaPromptRequest,
    MetaPromptSchema,
    SaveCreativeRequest,
    SourceItem,
)
from schemas.pipeline_schemas import AgentPlanningSchema, ToolCall
from services.creative_service import (
    delete_event_creation,
    generate_creative_content,
    generate_creative_meta_prompt,
    get_event_creation,
    save_creative_content,
)
from services.dashboard_service import get_dashboard_statistics, get_system_insights
from services.log_service import (
    delete_event_log,
    get_event_log,
    log_metrics_async,
    save_edited_summary,
)
from services.memory_service import (
    delete_event_briefing,
    generate_event_briefing,
    get_briefing_audit_trail,
    save_event_briefing,
    search_memory_explorer,
    update_event_briefing,
)
from services.prompt_manager import EventBriefingSchema


class TestMemoryAndBriefingService:
    """memory_service.py (벡터 기억 탐색기, 심층 리포트 생성 및 Audit Trail) 검증."""

    @pytest.mark.asyncio
    async def test_search_memory_explorer_returns_paginated_items(
        self, mock_db_session: MagicMock, sample_vector_3072: list[float]
    ) -> None:
        mock_emb = MagicMock()
        mock_emb.get_embedding = AsyncMock(return_value=sample_vector_3072)

        mock_rag = MagicMock()
        mock_rag.explore_memories.return_value = (
            [
                {
                    "memory_id": 101,
                    "base_entity_id": 1024,
                    "event_date": date(2026, 10, 15),
                    "memory_type": "LTM",
                    "content_text": "알파오메가 단가 협상",
                    "core_keywords": ["단가"],
                    "source_event_ids": [501],
                    "base_distance": 0.12,
                    "adjusted_distance": 0.12,
                    "distance": 0.12,
                }
            ],
            {"total_count": 1, "current_page": 1, "total_pages": 1, "limit": 10},
        )

        with patch(
            "services.memory_service.EmbeddingService", return_value=mock_emb
        ), patch("services.memory_service.RagService", return_value=mock_rag):
            req = MemorySearchRequest(
                query_text="단가 협상",
                page=1,
                limit=10,
                distance_threshold=0.5,
                base_entity_id=1024,
                include_dwh=False,
            )
            res = await search_memory_explorer(req, mock_db_session)

        assert res.status == "success"
        assert len(res.data) == 1
        assert res.data[0].memory_id == 101

    @pytest.mark.asyncio
    async def test_generate_and_save_event_briefing(
        self, mock_db_session: MagicMock
    ) -> None:
        mem_obj = EventMemory(
            memory_id=101,
            base_entity_id=1024,
            target_entity_id=9991,
            content_text="핵심 기억 요약",
            source_event_ids=[501],
        )
        q_mem = MagicMock()
        q_mem.filter.return_value.all.return_value = [mem_obj]
        mock_db_session.query.return_value = q_mem

        plan_dto = AgentPlanningSchema(
            reasoning="상세 팩트 인출 필요",
            tool_calls=[ToolCall(tool_name="FETCH_FACT_DETAILS", target_ids=[501])],
        )
        brief_dto = EventBriefingSchema(
            executive_summary="최종 경영진 총평",
            key_findings=["핵심 발견 1"],
            risk_and_warnings=["리스크 없음"],
            recommended_actions=["즉시 계약 체결"],
        )

        mock_lrse = MagicMock()
        mock_lrse.extract_fact = AsyncMock(side_effect=[plan_dto, brief_dto])

        with patch("services.memory_service.LRSEClient", return_value=mock_lrse), patch(
            "services.memory_service.get_ext_data_text", return_value="EXT 데이터"
        ), patch(
            "services.memory_service.execute_fetch_detailed_facts",
            return_value="상세 팩트 501",
        ), patch(
            "services.memory_service.get_dynamic_prompt",
            side_effect=[
                ("Plan Prompt", AgentPlanningSchema, 0.2, 1000),
                ("Brief Prompt", EventBriefingSchema, 0.2, 1500),
            ],
        ):
            gen_req = GenerateBriefingRequest(
                query_text="협상 리포트 작성",
                selected_memory_ids=[101],
                base_entity_id=1024,
            )
            gen_res = await generate_event_briefing(gen_req, mock_db_session, "Korean")

        assert gen_res["status"] == "success"
        assert gen_res["data"]["executive_summary"] == "최종 경영진 총평"

        save_req = SaveBriefingRequest(
            base_entity_id=1024,
            query_text="협상 리포트 작성",
            executive_summary="최종 경영진 총평",
            key_findings=["핵심 발견 1"],
            risk_and_warnings=[],
            recommended_actions=["즉시 계약 체결"],
            source_memory_ids=[101],
        )
        save_res = save_event_briefing(save_req, mock_db_session)
        assert save_res["status"] == "success"
        mock_db_session.add.assert_called_once()

    def test_briefing_audit_trail_and_update_delete(
        self, mock_db_session: MagicMock
    ) -> None:
        brief_rec = EventBriefing(
            briefing_id=701,
            base_entity_id=1024,
            query_text="기존 질의",
            executive_summary="기존 총평",
            source_memory_ids=[101],
        )
        mem_rec = EventMemory(
            memory_id=101,
            content_text="근거 기억",
            event_date=date(2026, 10, 15),
            source_event_ids=[501],
        )

        q_brief = MagicMock()
        q_brief.filter.return_value.first.return_value = brief_rec
        q_mem = MagicMock()
        q_mem.filter.return_value.order_by.return_value.all.return_value = [mem_rec]

        mock_db_session.query.side_effect = [q_brief, q_mem]
        audit_res = get_briefing_audit_trail(701, 1024, mock_db_session)
        assert len(audit_res["data"]) == 1
        assert audit_res["data"][0]["memory_id"] == 101

        # Update & Delete 검증
        mock_db_session.query.side_effect = None
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            brief_rec
        )
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        upd_req = UpdateBriefingRequest(
            base_entity_id=1024,
            query_text="수정된 질의",
            executive_summary="수정된 총평",
            key_findings=["발견"],
            risk_and_warnings=[],
            recommended_actions=[],
        )
        upd_res = update_event_briefing(701, upd_req, mock_db_session)
        assert upd_res["status"] == "success"
        assert brief_rec.executive_summary == "수정된 총평"

        del_res = delete_event_briefing(701, 1024, mock_db_session)
        assert del_res["status"] == "success"


class TestCreativeStudioService:
    """creative_service.py (2차 창작 팩트 보존 검증 및 메타 프롬프트 역설계) 검증."""

    @pytest.mark.asyncio
    async def test_generate_creative_content_blocks_hallucination_when_check_fails(
        self, mock_db_session: MagicMock
    ) -> None:
        log_rec = EventLog(
            log_id=11, base_entity_id=1024, llm_summary="원본 단기 일지 요약"
        )
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            log_rec
        )

        distorted_dto = CreativeContentSchema(
            fact_preservation_check=False,
            creative_title="왜곡된 제목",
            creative_content="왜곡된 본문",
        )
        valid_dto = CreativeContentSchema(
            fact_preservation_check=True,
            creative_title="정확한 보도자료 제목",
            creative_content="원본 팩트를 보존한 본문",
        )

        mock_lrse = MagicMock()
        mock_lrse.extract_fact = AsyncMock(side_effect=[distorted_dto, valid_dto])

        req = GenerateCreativeRequest(
            sources=[SourceItem(source_type="LOG", source_id=11)],
            base_entity_id=1024,
            system_instruction="보도자료 톤으로 작성",
            temperature=0.5,
            max_length=500,
        )

        with patch("services.creative_service.LRSEClient", return_value=mock_lrse):
            # 1. fact_preservation_check=False일 때 환각 차단 예외 발생 검증
            with pytest.raises(Exception, match="원본 팩트가 훼손되거나 왜곡"):
                await generate_creative_content(req, mock_db_session, "Korean")

            # 2. fact_preservation_check=True일 때 정상 반환 검증
            ok_res = await generate_creative_content(req, mock_db_session, "Korean")
            assert ok_res["status"] == "success"
            assert ok_res["data"]["creative_title"] == "정확한 보도자료 제목"

    @pytest.mark.asyncio
    async def test_meta_prompt_and_save_delete_creation(
        self, mock_db_session: MagicMock
    ) -> None:
        mock_lrse = MagicMock()
        mock_lrse.extract_fact = AsyncMock(
            return_value=MetaPromptSchema(generated_prompt="생성된 메타 프롬프트")
        )
        with patch("services.creative_service.LRSEClient", return_value=mock_lrse):
            meta_res = await generate_creative_meta_prompt(
                GenerateMetaPromptRequest(user_intent="간결한 보고서 톤"), "Korean"
            )
        assert meta_res["data"]["suggested_prompt"] == "생성된 메타 프롬프트"

        save_req = SaveCreativeRequest(
            sources=[
                SourceItem(source_type="LOG", source_id=1),
                SourceItem(source_type="BRIEFING", source_id=2),
            ],
            base_entity_id=1024,
            tone_name="PR_TONE",
            creative_title="창작 제목",
            creative_content="창작 본문",
        )
        save_res = save_creative_content(save_req, mock_db_session)
        assert save_res["status"] == "success"

        creation_rec = EventCreation(
            creation_id=88,
            base_entity_id=1024,
            source_log_ids=[1],
            source_briefing_ids=[2],
            source_creation_ids=[],
            tone_name="PR_TONE",
            creative_title="창작 제목",
            creative_content="창작 본문",
            ne_ts=datetime(2026, 10, 15, 12, 0, 0),
        )
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            creation_rec
        )
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        fetched = get_event_creation(88, 1024, mock_db_session)
        assert fetched["data"]["creation_id"] == 88
        assert len(fetched["data"]["sources"]) == 2

        del_res = delete_event_creation(88, 1024, mock_db_session)
        assert del_res["status"] == "success"


class TestLogAndDashboardServices:
    """log_service.py 및 dashboard_service.py (일지 저장/조회, 대시보드 통계 및 인사이트) 검증."""

    def test_save_edited_summary_and_get_delete_event_log(
        self, mock_db_session: MagicMock
    ) -> None:
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        save_req = SaveSummaryRequest(
            base_entity_id=1024,
            reference_date=date(2026, 10, 15),
            edited_summary="오늘의 신규 요약",
            action_items=[
                ActionItem(task="계약서 검토", status_id=0, due_date="2026-10-20")
            ],
        )
        res = save_edited_summary(save_req, mock_db_session)
        assert res["status"] == "success"

        existing_log = EventLog(
            log_id=55,
            base_entity_id=1024,
            log_date=date(2026, 10, 15),
            llm_summary="기존 일지",
            action_items='[{"task": "업무1", "status_id": 0, "due_date": "2026-10-20"}]',
        )
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            existing_log
        )
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        single = get_event_log(55, 1024, mock_db_session)
        assert single["data"]["log_id"] == 55
        assert isinstance(single["data"]["action_items"], list)

        del_res = delete_event_log(55, 1024, mock_db_session)
        assert del_res["status"] == "success"

    @pytest.mark.asyncio
    async def test_log_metrics_async_executes_background_insert(self) -> None:
        with patch("services.log_service._insert_llm_metric") as mock_insert:
            await log_metrics_async(
                {"latency_ms": 200, "total_tokens": 500}, "HierarchicalFactSchema", 1024
            )
            mock_insert.assert_called_once()

    def test_dashboard_statistics_and_system_insights(
        self, mock_db_session: MagicMock
    ) -> None:
        q_mock = MagicMock()
        q_mock.filter.return_value = q_mock
        q_mock.group_by.return_value = q_mock
        q_mock.order_by.return_value = q_mock
        q_mock.limit.return_value = q_mock
        q_mock.distinct.return_value = q_mock
        q_mock.all.return_value = []
        q_mock.count.return_value = 42
        q_mock.first.return_value = MagicMock(
            total_tokens=1000000, avg_latency=350, total_retries=2
        )
        mock_db_session.query.return_value = q_mock

        stats = get_dashboard_statistics(mock_db_session, 1024)
        assert stats["status"] == "success"
        assert stats["data"]["total_memories"] == 42

        insights = get_system_insights(mock_db_session, 1024)
        assert insights["status"] == "success"
        assert insights["data"]["cost_stat"]["tokens"] == 1000000
        assert insights["data"]["cost_stat"]["cost"] == pytest.approx(0.075)