from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from routers.chat_router import chat_endpoint, get_target_language
from routers.dashboard_router import get_dashboard_statistics, get_system_insights
from routers.master_router import (
    get_entity_types,
    get_object_types,
    get_status_options,
    get_target_language as get_master_target_language,
)
from routers.pipeline_router import (
    fact_check,
    get_pipeline_status,
)
from routers.prompt_router import get_default_prompts
from routers.system_router import (
    get_system_config,
    get_system_settings,
    get_tables,
    update_system_settings,
)
from schemas.api_schemas import (
    ChatRequest,
    FactCheckRequest,
    GuideBotSchema,
    UpdateSystemSettingsRequest,
)


class TestRouterI18nHeaderResolution:
    """라우터 공통 get_target_language 다국어 헤더 파싱(ja, en, ko) 검증."""

    @pytest.mark.parametrize(
        "accept_lang,x_target_lang,expected",
        [
            ("ko-KR,ko;q=0.9", "Japanese", "Japanese"),
            ("ja-JP,ja;q=0.9,en-US;q=0.8", None, "Japanese"),
            ("en-US,en;q=0.9", None, "English"),
            ("ko-KR,ko;q=0.9", None, "Korean"),
            ("fr-FR,fr;q=0.9", None, "Korean"),
            (None, None, "Korean"),
        ],
    )
    def test_get_target_language_priority_and_fallback(
        self,
        accept_lang: str | None,
        x_target_lang: str | None,
        expected: str,
    ) -> None:
        resolved = get_target_language(
            accept_language=accept_lang, x_target_language=x_target_lang
        )
        assert resolved == expected
        assert (
            get_master_target_language(
                accept_language=accept_lang, x_target_language=x_target_lang
            )
            == expected
        )


class TestChatbotAndSystemRouters:
    """chat_router.py, chat_service.py, system_router.py, prompt_router.py 검증."""

    @pytest.mark.asyncio
    async def test_chat_endpoint_and_service_navigation_response(self) -> None:
        bot_dto = GuideBotSchema(
            answer="파이프라인 스튜디오 화면으로 안내해 드리겠습니다.",
            action_code="NAVIGATE",
            target_menu="BUILDER",
        )
        mock_lrse = MagicMock()
        mock_lrse.extract_fact = AsyncMock(return_value=bot_dto)

        with patch("services.chat_service.LRSEClient", return_value=mock_lrse):
            req = ChatRequest(
                session_id="guide_sess_01",
                user_message="파이프라인 빌더로 이동해줘",
                base_entity_id=1024,
            )
            res = await chat_endpoint(req, target_lang="Korean")

        assert res["status"] == "success"
        assert res["data"]["action_code"] == "NAVIGATE"
        assert res["data"]["target_menu"] == "BUILDER"

    def test_prompt_and_system_router_endpoints(
        self, mock_db_session: MagicMock
    ) -> None:
        defaults_res = get_default_prompts()
        assert defaults_res["status"] == "success"
        assert "A_EXTRACTION" in defaults_res["data"]
        assert "B_SYNTHESIS" in defaults_res["data"]

        cfg_res = get_system_config()
        assert cfg_res["status"] == "success"

        with patch(
            "services.system_service.get_dynamic_settings",
            return_value={"GEMINI_API_KEY": "masked-key", "MODEL_NAME": "auto"},
        ):
            settings_res = get_system_settings()
            assert settings_res["model_name"] == "auto"

        with patch(
            "services.system_service.update_dynamic_settings",
            return_value={"status": "success", "message": "updated"},
        ):
            upd_res = update_system_settings(
                UpdateSystemSettingsRequest(api_key="new-k", model_name="auto")
            )
            assert upd_res["status"] == "success"

        mock_db_session.execute.return_value.fetchall.return_value = [
            ("event_facts",),
            ("event_memories",),
        ]
        tables_res = get_tables("core", db=mock_db_session)
        assert tables_res["data"] == ["event_facts", "event_memories"]


class TestPipelineDashboardAndMasterRouters:
    """pipeline_router.py, dashboard_router.py, master_router.py 위임 호출 검증."""

    @pytest.mark.asyncio
    async def test_pipeline_router_delegation(
        self, mock_db_session: MagicMock
    ) -> None:
        with patch(
            "services.pipeline_service.process_fact_check",
            new_callable=AsyncMock,
            return_value={"has_conflict": False, "discrepancies": []},
        ):
            fc_res = await fact_check(
                FactCheckRequest(base_entity_id=1024, reference_date="2026-10-15"),
                db=mock_db_session,
                target_lang="Japanese",
            )
            assert fc_res["has_conflict"] is False

        with patch(
            "services.pipeline_service.get_pipeline_status",
            return_value={"total_count": 10},
        ):
            st_res = get_pipeline_status(base_entity_id=1024, db=mock_db_session)
            assert st_res["total_count"] == 10

    def test_dashboard_and_master_router_delegation(
        self, mock_db_session: MagicMock
    ) -> None:
        with patch(
            "services.dashboard_service.get_dashboard_statistics",
            return_value={"status": "success", "data": {}},
        ):
            assert (
                get_dashboard_statistics(1024, db=mock_db_session)["status"]
                == "success"
            )

        with patch(
            "services.dashboard_service.get_system_insights",
            return_value={"status": "success", "data": {}},
        ):
            assert get_system_insights(1024, db=mock_db_session)["status"] == "success"

        mock_db_session.query.return_value.filter.return_value.distinct.return_value.all.return_value = [
            ("COMPANY",),
            ("CLIENT",),
        ]
        ent_types = get_entity_types(db=mock_db_session)
        assert ent_types["data"] == ["COMPANY", "CLIENT"]

        obj_types = get_object_types(db=mock_db_session)
        assert obj_types["data"] == ["COMPANY", "CLIENT"]

        mock_db_session.query.return_value.filter.return_value.order_by.return_value.all.return_value = []
        opts = get_status_options("ENTITY", db=mock_db_session, target_lang="Korean")
        assert opts["status"] == "success"