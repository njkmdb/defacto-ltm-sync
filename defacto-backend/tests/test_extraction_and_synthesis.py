from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from database.models import (
    EventBriefing,
    EventCreation,
    EventFact,
    EventMemory,
    EventRaw,
    ExtEvent,
    ExtMst,
    MstEntity,
    MstObject,
)
from schemas.api_schemas import (
    CreateRawEventRequest,
    FactCheckRequest,
    StructureEventsRequest,
    SynthesizeContextRequest,
    UpdateRawEventRequest,
)
from schemas.pipeline_schemas import ContextSynthesisSchema, DiscrepancyItem, FactCheckSchema
from services.extraction_service import get_pipeline_status, process_structure_events
from services.prompt_manager import HierarchicalFactSchema
from services.raw_event_service import (
    analyze_raw_event_impact,
    create_raw_event,
    delete_raw_event,
    get_raw_event_status,
    update_raw_event,
)
from services.synthesis_service import (
    MAX_FETCH_LIMIT,
    execute_fetch_detailed_facts,
    execute_fetch_entity_master,
    execute_fetch_object_master,
    get_ext_data_text,
    process_fact_check,
    process_synthesize_context,
)


class TestExtractionServicePipeline:
    """extraction_service.py (Process A: 비정형 팩트 구조화 및 LTM 적재) 단위 테스트."""

    @pytest.mark.asyncio
    async def test_process_structure_events_handles_missing_and_already_synced_records(
        self, mock_db_session: MagicMock
    ) -> None:
        synced_raw = EventRaw(
            raw_id=10,
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            raw_content="이미 처리된 원본 텍스트",
            sync_status_id=1,
        )

        q_missing = MagicMock()
        q_missing.filter.return_value.first.return_value = None

        q_synced = MagicMock()
        q_synced.filter.return_value.first.return_value = synced_raw

        mock_db_session.query.side_effect = [q_missing, q_synced]

        with patch("services.extraction_service.LRSEClient"), patch(
            "services.extraction_service.EmbeddingService"
        ):
            req = StructureEventsRequest(
                base_entity_id=1024,
                target_raw_ids=[999, 10],
                schema_name="HierarchicalFactSchema",
                retry_failed=False,
            )
            res = await process_structure_events(req, mock_db_session, "Korean")

        assert res.status == "failed"
        assert len(res.results) == 2
        assert res.results[0].raw_id == 999
        assert res.results[0].sync_status_id == 2
        assert res.results[1].raw_id == 10
        assert res.results[1].sync_status_id == 1

    @pytest.mark.asyncio
    async def test_process_structure_events_success_and_fail_safe_rollback(
        self, mock_db_session: MagicMock, sample_vector_3072: list[float]
    ) -> None:
        pending_raw_ok = EventRaw(
            raw_id=20,
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            raw_content="알파오메가와 신규 단가 협상 진행",
            sync_status_id=0,
        )
        pending_raw_err = EventRaw(
            raw_id=21,
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            raw_content="에러 유발 원본 텍스트",
            sync_status_id=0,
        )

        q_ok = MagicMock()
        q_ok.filter.return_value.first.return_value = pending_raw_ok
        q_err = MagicMock()
        q_err.filter.return_value.first.return_value = pending_raw_err

        mock_db_session.query.side_effect = [q_ok, q_err]
        mock_db_session.execute.return_value.fetchall.return_value = [
            (9991, "알파오메가")
        ]

        extracted_dto = HierarchicalFactSchema(
            ref_entity_id_1=9991,
            fact_content="알파오메가와 신규 단가 협상을 진행하였다.",
            attributes={"stage": "NEGOTIATION"},
            content_text="알파오메가 단가 협상 요약",
            core_keywords=["알파오메가", "단가"],
        )

        mock_lrse_instance = MagicMock()
        mock_lrse_instance.extract_fact = AsyncMock(
            side_effect=[extracted_dto, RuntimeError("LRSE RPC Timeout")]
        )

        mock_emb_instance = MagicMock()
        mock_emb_instance.get_embedding = AsyncMock(return_value=sample_vector_3072)

        with patch(
            "services.extraction_service.LRSEClient", return_value=mock_lrse_instance
        ), patch(
            "services.extraction_service.EmbeddingService",
            return_value=mock_emb_instance,
        ), patch(
            "services.extraction_service.get_dynamic_prompt",
            return_value=("System Prompt", HierarchicalFactSchema, 0.2, 1000),
        ):
            req = StructureEventsRequest(
                base_entity_id=1024,
                target_raw_ids=[20, 21],
                schema_name="HierarchicalFactSchema",
                retry_failed=True,
            )
            res = await process_structure_events(req, mock_db_session, "Korean")

        assert res.status == "partial_success"
        assert pending_raw_ok.sync_status_id == 1
        assert pending_raw_err.sync_status_id == 2
        assert "[Pipeline Failed]" in (pending_raw_err.error_log or "")
        mock_db_session.rollback.assert_called_once()

    def test_get_pipeline_status_returns_aggregated_counts(
        self, mock_db_session: MagicMock
    ) -> None:
        sample_raw = EventRaw(
            raw_id=1,
            base_entity_id=1024,
            sync_status_id=1,
            event_date=date(2026, 10, 15),
            raw_content="샘플 원문",
            error_log=None,
        )
        base_q = MagicMock()
        base_q.filter.return_value = base_q
        base_q.count.return_value = 5
        base_q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            sample_raw
        ]
        mock_db_session.query.return_value = base_q

        status_dict = get_pipeline_status(
            db=mock_db_session,
            base_entity_id=1024,
            page=1,
            limit=10,
            start_date="2026-10-01",
            end_date="2026-10-31",
            status_filter="1",
        )
        assert status_dict["total_count"] == 5
        assert len(status_dict["data_list"]) == 1
        assert status_dict["data_list"][0]["raw_id"] == 1


class TestSynthesisServiceAndContextProtection:
    """synthesis_service.py (Process B: 상세 팩트 인출, 마스터 참조, 컨텍스트 합성) 검증."""

    def test_execute_fetch_detailed_facts_enforces_max_fetch_limit(
        self, mock_db_session: MagicMock
    ) -> None:
        assert execute_fetch_detailed_facts(mock_db_session, [], 1024) == ""

        fake_fact = EventFact(
            event_id=501,
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            fact_content="상세 팩트 원문 내용",
            attributes={"amount": 3000000},
        )
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.order_by.return_value = mock_q
        mock_q.limit.return_value = mock_q
        mock_q.all.return_value = [fake_fact]
        mock_db_session.query.return_value = mock_q

        # MAX_FETCH_LIMIT(15) 초과 ID 배열 전달 시 컨텍스트 보호 알림 삽입 검증
        over_limit_ids = list(range(1, MAX_FETCH_LIMIT + 5))
        text_out = execute_fetch_detailed_facts(
            mock_db_session, over_limit_ids, base_entity_id=1024, override_limit=False
        )

        assert "【인출된 상세 팩트(Detail) 원문 데이터】" in text_out
        assert "상세 팩트 원문 내용" in text_out
        assert "[System Alert: 컨텍스트 보호 모드 가동" in text_out

    def test_execute_fetch_entity_and_object_masters(
        self, mock_db_session: MagicMock
    ) -> None:
        assert execute_fetch_entity_master(mock_db_session, []) == ""
        assert execute_fetch_object_master(mock_db_session, []) == ""

        entity_obj = MstEntity(
            entity_id=9991,
            entity_type="COMPANY",
            entity_name="미래통상",
            attributes={"grade": "VIP"},
        )
        object_obj = MstObject(
            object_id=8881,
            object_type="PRODUCT",
            object_name="LLMOps 라이선스",
            attributes={"sku": "LLM-01"},
        )

        q_ent = MagicMock()
        q_ent.filter.return_value.all.return_value = [entity_obj]
        q_obj = MagicMock()
        q_obj.filter.return_value.all.return_value = [object_obj]

        mock_db_session.query.side_effect = [q_ent, q_obj]

        ent_str = execute_fetch_entity_master(mock_db_session, [9991])
        obj_str = execute_fetch_object_master(mock_db_session, [8881])

        assert "미래통상" in ent_str
        assert "LLMOps 라이선스" in obj_str

    def test_get_ext_data_text_formats_mst_and_events(
        self, mock_db_session: MagicMock
    ) -> None:
        ext_mst = ExtMst(
            base_entity_id=1024,
            ext_source="CRM",
            ext_type="CUSTOMER_GRADE",
            attributes={"tier": "Enterprise"},
        )
        ext_ev = ExtEvent(
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            ext_source="ERP",
            event_type="CONTRACT",
            event_amount=Decimal("3000000"),
            attributes={"target": "미래통상"},
        )

        q_mst = MagicMock()
        q_mst.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            ext_mst
        ]
        q_ev = MagicMock()
        q_ev.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
            ext_ev
        ]
        mock_db_session.query.side_effect = [q_mst, q_ev]

        ext_text = get_ext_data_text(mock_db_session, 1024)
        assert "【외부 정형 마스터 정보】" in ext_text
        assert "【외부 정형 이벤트 내역】" in ext_text
        assert "3,000,000원" in ext_text

    @pytest.mark.asyncio
    async def test_process_synthesize_context_returns_empty_when_no_today_raws(
        self, mock_db_session: MagicMock
    ) -> None:
        q_empty = MagicMock()
        q_empty.filter.return_value.all.return_value = []
        mock_db_session.query.return_value = q_empty

        with patch("services.synthesis_service.LRSEClient"), patch(
            "services.synthesis_service.RagOrchestrator"
        ), patch("services.synthesis_service.EmbeddingService"):
            req = SynthesizeContextRequest(
                base_entity_id=1024,
                reference_date=date(2026, 10, 15),
                schema_name="ContextSynthesisSchema",
                use_deep_search=False,
            )
            res = await process_synthesize_context(req, mock_db_session)

        assert res.status == "success"
        assert res.data.log_id == 0
        assert res.data.rag_metrics.memory_type_used == "NONE"

    @pytest.mark.asyncio
    async def test_process_fact_check_detects_discrepancies(
        self, mock_db_session: MagicMock
    ) -> None:
        mem = EventMemory(
            memory_id=101,
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            memory_type="LTM",
            content_text="미래통상 계약금 500만 원",
            source_event_ids=[501],
        )
        q_mem = MagicMock()
        q_mem.filter.return_value.all.return_value = [mem]

        q_fact = MagicMock()
        q_fact.filter.return_value.all.return_value = [
            MagicMock(event_id=501, raw_id=77)
        ]

        mock_db_session.query.side_effect = [q_mem, q_fact]

        expected_fc = FactCheckSchema(
            has_conflict=True,
            discrepancies=[
                DiscrepancyItem(
                    source_raw_id=77,
                    issue_topic="계약 금액",
                    ai_memory_value="500만 원",
                    ext_truth_value="300만 원",
                    recommended_correction="300만 원으로 정정",
                )
            ],
        )
        mock_lrse = MagicMock()
        mock_lrse.extract_fact = AsyncMock(return_value=expected_fc)

        with patch("services.synthesis_service.LRSEClient", return_value=mock_lrse), patch(
            "services.synthesis_service.get_ext_data_text",
            return_value="ERP 계약금: 3,000,000원",
        ), patch(
            "services.synthesis_service.get_dynamic_prompt",
            return_value=("Fact check prompt", FactCheckSchema, 0.0, 1000),
        ):
            req = FactCheckRequest(base_entity_id=1024, reference_date="2026-10-15")
            res = await process_fact_check(req, mock_db_session)

        assert res["has_conflict"] is True
        assert res["discrepancies"][0]["source_raw_id"] == 77


class TestRawEventServiceCascadeAndImpact:
    """raw_event_service.py (수동 적재, 교정 시 Cascade 초기화, 영향도 분석) 검증."""

    @pytest.mark.asyncio
    async def test_create_and_get_raw_event_status(
        self, mock_db_session: MagicMock
    ) -> None:
        def _assign_id(obj: EventRaw) -> None:
            obj.raw_id = 301

        mock_db_session.refresh.side_effect = _assign_id

        create_req = CreateRawEventRequest(
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            raw_content="신규 수동 입력 텍스트",
            run_pipeline_now=False,
        )
        created = await create_raw_event(create_req, mock_db_session)
        assert created["status"] == "success"
        assert created["raw_id"] == 301

        mock_q = MagicMock()
        mock_q.filter.return_value.first.return_value = MagicMock(
            raw_id=301, sync_status_id=1, error_log=None
        )
        mock_db_session.query.return_value = mock_q

        status_res = get_raw_event_status(301, 1024, mock_db_session)
        assert status_res["raw_id"] == 301
        assert status_res["sync_status_id"] == 1

    def test_analyze_raw_event_impact_traces_briefings_and_creations(
        self, mock_db_session: MagicMock
    ) -> None:
        q_raw = MagicMock()
        q_raw.filter.return_value.first.return_value = EventRaw(
            raw_id=50, base_entity_id=1024
        )
        q_facts = MagicMock()
        q_facts.filter.return_value.all.return_value = [(501,)]
        q_mems = MagicMock()
        q_mems.filter.return_value.all.return_value = [(1001,)]
        q_briefings = MagicMock()
        q_briefings.filter.return_value.all.return_value = [
            EventBriefing(briefing_id=2001, query_text="알파오메가 협상 요약")
        ]
        q_creations = MagicMock()
        q_creations.filter.return_value.all.return_value = [
            EventCreation(creation_id=3001, creative_title="협상 성공 보도자료")
        ]

        mock_db_session.query.side_effect = [
            q_raw,
            q_facts,
            q_mems,
            q_briefings,
            q_creations,
        ]

        impact = analyze_raw_event_impact(50, 1024, mock_db_session)
        assert impact["status"] == "success"
        assert impact["affected_count"] == 2
        assert impact["affected_items"][0]["item_type"] == "BRIEFING"
        assert impact["affected_items"][1]["item_type"] == "CREATION"

    @pytest.mark.asyncio
    async def test_update_and_delete_raw_event_soft_disconnect(
        self, mock_db_session: MagicMock
    ) -> None:
        raw_rec = EventRaw(
            raw_id=60,
            base_entity_id=1024,
            event_date=date(2026, 10, 15),
            raw_content="수정 전 텍스트",
            sync_status_id=0,
        )
        q_raw = MagicMock()
        q_raw.filter.return_value.first.return_value = raw_rec
        mock_db_session.query.return_value = q_raw

        upd_req = UpdateRawEventRequest(
            base_entity_id=1024,
            event_date=date(2026, 10, 16),
            raw_content="수정 후 텍스트",
            run_pipeline_now=False,
        )
        upd_res = await update_raw_event(60, upd_req, mock_db_session)
        assert upd_res["status"] == "success"
        assert raw_rec.raw_content == "수정 후 텍스트"

        del_res = await delete_raw_event(60, 1024, "SOFT_DISCONNECT", mock_db_session)
        assert del_res["status"] == "success"
        assert raw_rec.sync_status_id == 9