from datetime import date
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from schemas.pipeline_schemas import (
    DiscrepancyItem,
    FactCheckSchema,
    PipelineExecutionRequest,
    PipelineStep,
)
from services.pipeline_core import BaseNode, PipelineContext, PipelineOrchestrator
from services.pipeline_nodes import (
    PersistDBNode,
    PreFactCheckNode,
    TestErrorNode,
    build_node_registry,
)


class DummyEchoNode(BaseNode):
    """파이프라인 오케스트레이터 단위 테스트용 에코 노드."""

    async def execute(
        self, params: Dict[str, Any], context: PipelineContext, db: Session
    ) -> Any:
        return {
            "tenant": context.base_entity_id,
            "received_params": params,
        }


class TestPipelineContextInterpolation:
    """PipelineContext의 동적 템플릿 엔진(Interpolation) 정밀 검증."""

    def test_exact_variable_match_preserves_native_type(self) -> None:
        initial_data = {
            "query_text": "단가 협상 이력 조회",
            "target_ids": [101, 102, 103],
            "use_pre_fact_check": True,
        }
        ctx = PipelineContext(base_entity_id=1024, initial_data=initial_data)
        ctx.state["step1_out"] = {"nested_dict": {"score": 0.98}, "items": ["A", "B"]}

        params = {
            "raw_list": "{{ initial_context.target_ids }}",
            "flag": "{{initial_context.use_pre_fact_check}}",
            "nested_obj": "{{ step1_out.nested_dict }}",
        }
        resolved = ctx.resolve_params(params)

        assert isinstance(resolved["raw_list"], list)
        assert resolved["raw_list"] == [101, 102, 103]
        assert resolved["flag"] is True
        assert resolved["nested_obj"] == {"score": 0.98}

    def test_inline_string_interpolation_merges_multiple_tokens(self) -> None:
        ctx = PipelineContext(
            base_entity_id=1024,
            initial_data={"reference_date": "2026-10-15"},
        )
        ctx.state["ltm_search_result"] = {
            "today_formatted_text": "오늘 계약 300만 원 확정",
            "formatted_text": "과거 단가 협의 내역",
        }
        ctx.state["ext_data_result"] = "ERP 계약 금액: 3,000,000원"

        template_params = {
            "ltm_context_text": (
                "【일자: {{initial_context.reference_date}}】\n"
                "Today: {{ltm_search_result.today_formatted_text}}\n"
                "LTM: {{ltm_search_result.formatted_text}}"
            ),
            "ext_data_text": "{{ext_data_result}}",
        }
        resolved = ctx.resolve_params(template_params)

        assert "2026-10-15" in resolved["ltm_context_text"]
        assert "오늘 계약 300만 원 확정" in resolved["ltm_context_text"]
        assert "과거 단가 협의 내역" in resolved["ltm_context_text"]
        assert resolved["ext_data_text"] == "ERP 계약 금액: 3,000,000원"

    def test_missing_state_key_resolves_gracefully(self) -> None:
        ctx = PipelineContext(base_entity_id=1024, initial_data={})
        resolved = ctx.resolve_params(
            {
                "exact_missing": "{{non_existent.key}}",
                "inline_missing": "Prefix: {{non_existent.key}}!",
            }
        )
        assert resolved["exact_missing"] is None
        assert resolved["inline_missing"] == "Prefix: !"


class TestPipelineOrchestratorExecution:
    """PipelineOrchestrator의 위상 정렬 실행 및 트랜잭션 롤백 무결성 검증."""

    @pytest.mark.asyncio
    async def test_steps_execute_in_topological_step_order(
        self, mock_db_session: MagicMock
    ) -> None:
        orchestrator = PipelineOrchestrator(db=mock_db_session)
        orchestrator.register_node("Echo_Node", DummyEchoNode())

        # 의도적으로 step_order가 역순(2 -> 1)인 배열을 주입하여 정렬 실행 검증
        request = PipelineExecutionRequest(
            base_entity_id=1024,
            initial_context={"seed": "alpha"},
            steps=[
                PipelineStep(
                    step_id="step_second",
                    step_order=2,
                    module_name="Echo_Node",
                    params={"prev": "{{first_out.received_params.input_val}}"},
                    output_key="second_out",
                ),
                PipelineStep(
                    step_id="step_first",
                    step_order=1,
                    module_name="Echo_Node",
                    params={"input_val": "{{initial_context.seed}}"},
                    output_key="first_out",
                ),
            ],
        )

        response = await orchestrator.execute(request)

        assert response["status"] == "success"
        final_state = response["final_state"]
        assert final_state["first_out"]["received_params"]["input_val"] == "alpha"
        assert final_state["second_out"]["received_params"]["prev"] == "alpha"
        mock_db_session.begin_nested.assert_called_once()

    @pytest.mark.asyncio
    async def test_unregistered_module_raises_value_error(
        self, mock_db_session: MagicMock
    ) -> None:
        orchestrator = PipelineOrchestrator(db=mock_db_session)
        request = PipelineExecutionRequest(
            base_entity_id=1024,
            initial_context={},
            steps=[
                PipelineStep(
                    step_id="unknown_01",
                    step_order=1,
                    module_name="Unauthorized_Module",
                    params={},
                    output_key="out",
                )
            ],
        )

        with pytest.raises(ValueError, match="인가되지 않거나 알 수 없는 모듈"):
            await orchestrator.execute(request)

    @pytest.mark.asyncio
    async def test_persist_db_and_test_error_node_rollback_scenario(
        self, mock_db_session: MagicMock
    ) -> None:
        orchestrator = PipelineOrchestrator(db=mock_db_session)
        for name, node in build_node_registry().items():
            orchestrator.register_node(name, node)

        request = PipelineExecutionRequest(
            base_entity_id=1024,
            initial_context={"reference_date": "2026-10-15", "trigger_qa_error": True},
            steps=[
                PipelineStep(
                    step_id="node_persist_01",
                    step_order=1,
                    module_name="Persist_DB",
                    params={
                        "target_table": "event_logs",
                        "reference_date": "{{initial_context.reference_date}}",
                        "data": {
                            "llm_summary": "롤백 테스트용 임시 요약",
                            "action_items": [],
                        },
                    },
                    output_key="db_save_result",
                ),
                PipelineStep(
                    step_id="node_error_02",
                    step_order=2,
                    module_name="Test_Error",
                    params={"trigger_error": "{{initial_context.trigger_qa_error}}"},
                    output_key="error_result",
                ),
            ],
        )

        with pytest.raises(ValueError, match="Shadow Mode QA"):
            await orchestrator.execute(request)

        # Persist_DB에서 add/flush가 호출되었으나 예외가 전파되어 상위 컨텍스트에서 롤백됨을 검증
        mock_db_session.add.assert_called_once()
        mock_db_session.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_pre_fact_check_node_aborts_on_erp_conflict(
        self, mock_db_session: MagicMock
    ) -> None:
        node = PreFactCheckNode()
        ctx = PipelineContext(base_entity_id=1024, initial_data={})

        conflict_response = FactCheckSchema(
            has_conflict=True,
            discrepancies=[
                DiscrepancyItem(
                    source_raw_id=77,
                    issue_topic="계약 금액 불일치",
                    ai_memory_value="5,000,000원",
                    ext_truth_value="3,000,000원",
                    recommended_correction="ERP 정형 데이터 기준 300만 원으로 수정",
                )
            ],
        )

        with patch(
            "services.pipeline_nodes.get_dynamic_prompt",
            return_value=("System prompt", FactCheckSchema, 0.0, 1000),
        ), patch(
            "services.pipeline_nodes.LRSEClient.extract_fact",
            new_callable=AsyncMock,
            return_value=conflict_response,
        ):
            with pytest.raises(ValueError, match="^FACT_CONFLICT::"):
                await node.execute(
                    params={
                        "ltm_context_text": "기억: 500만 원",
                        "ext_data_text": "ERP: 300만 원",
                        "use_pre_fact_check": True,
                    },
                    context=ctx,
                    db=mock_db_session,
                )