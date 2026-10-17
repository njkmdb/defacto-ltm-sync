from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from database.models import MstEntity, MstObject, MstPrompt, MstStatus
from schemas.api_schemas import (
    CreateMstEntityRequest,
    CreateMstObjectRequest,
    CreateMstStatusRequest,
    CreatePromptRequest,
    UpdateMstEntityRequest,
    UpdatePromptRequest,
)
from services.mst_entity_service import (
    create_mst_entity,
    delete_mst_entity,
    get_lang_code,
    get_mst_entities,
    update_mst_entity,
)
from services.mst_object_service import (
    create_mst_object,
    delete_mst_object,
    get_mst_objects,
)
from services.mst_status_service import (
    create_mst_status,
    delete_mst_status,
    get_active_status_options,
    update_mst_status,
)
from services.prompt_service import (
    create_prompt,
    delete_prompt,
    get_prompts,
    update_prompt,
)
from services.scheduler_service import (
    get_ext_sync_interval,
    run_ext_sync_job,
    update_ext_sync_interval,
)


class TestMasterDataServicesI18nAndProtection:
    """mst_entity_service.py, mst_object_service.py, mst_status_service.py 검증."""

    @pytest.mark.parametrize(
        "target_lang,expected_code",
        [
            ("Japanese", "ja"),
            ("English", "en"),
            ("Korean", "ko"),
            ("UnknownLang", "ko"),
        ],
    )
    def test_get_lang_code_mapping(
        self, target_lang: str, expected_code: str
    ) -> None:
        assert get_lang_code(target_lang) == expected_code

    def test_get_mst_entities_resolves_i18n_name_from_jsonb_attributes(
        self, mock_db_session: MagicMock
    ) -> None:
        entity_rec = MstEntity(
            entity_id=9991,
            parent_entity_id=None,
            entity_type="COMPANY",
            entity_name="미래통상",
            attributes={
                "name_ja": "未来通商株式会社",
                "name_en": "Mirae Trading Co.",
            },
            entity_status_id=1,
            ne_ts=datetime(2026, 10, 15, 9, 0, 0),
            up_ts=datetime(2026, 10, 15, 9, 0, 0),
        )
        q_mock = MagicMock()
        q_mock.filter.return_value = q_mock
        q_mock.count.return_value = 1
        q_mock.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            entity_rec
        ]
        mock_db_session.query.return_value = q_mock

        res_ja = get_mst_entities(
            db=mock_db_session, page=1, limit=20, target_lang="Japanese"
        )
        assert res_ja["data"][0]["entity_name"] == "未来通商株式会社"

        res_en = get_mst_entities(
            db=mock_db_session, page=1, limit=20, target_lang="English"
        )
        assert res_en["data"][0]["entity_name"] == "Mirae Trading Co."

    def test_create_update_and_soft_delete_mst_entity(
        self, mock_db_session: MagicMock
    ) -> None:
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        req = CreateMstEntityRequest(
            entity_id=2001,
            entity_type="CLIENT",
            entity_name="신규 거래처",
            attributes={"region": "Fukuoka"},
        )
        created = create_mst_entity(req, mock_db_session)
        assert created["status"] == "success"

        existing = MstEntity(
            entity_id=2001,
            entity_type="CLIENT",
            entity_name="신규 거래처",
            entity_status_id=1,
        )
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            existing
        )

        upd_req = UpdateMstEntityRequest(
            entity_id=2001,
            entity_type="PARTNER",
            entity_name="파트너 거래처",
            attributes={},
        )
        upd_res = update_mst_entity(2001, upd_req, mock_db_session)
        assert upd_res["status"] == "success"
        assert existing.entity_type == "PARTNER"

        del_res = delete_mst_entity(2001, mock_db_session)
        assert del_res["status"] == "success"
        assert existing.entity_status_id == 9

    def test_create_get_and_delete_mst_object(
        self, mock_db_session: MagicMock
    ) -> None:
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        create_res = create_mst_object(
            CreateMstObjectRequest(
                object_id=3001,
                object_type="SERVICE",
                object_name="RAG 엔진",
                attributes={"name_ja": "RAGエンジン"},
            ),
            mock_db_session,
        )
        assert create_res["status"] == "success"

        obj_rec = MstObject(
            object_id=3001,
            object_type="SERVICE",
            object_name="RAG 엔진",
            attributes={"name_ja": "RAGエンジン"},
            object_status_id=1,
        )
        q_mock = MagicMock()
        q_mock.filter.return_value = q_mock
        q_mock.count.return_value = 1
        q_mock.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            obj_rec
        ]
        q_mock.first.return_value = obj_rec
        mock_db_session.query.return_value = q_mock

        list_res = get_mst_objects(mock_db_session, target_lang="Japanese")
        assert list_res["data"][0]["object_name"] == "RAGエンジン"

        del_res = delete_mst_object(3001, mock_db_session)
        assert del_res["status"] == "success"
        assert obj_rec.object_status_id == 9

    def test_mst_status_protects_system_core_range(
        self, mock_db_session: MagicMock
    ) -> None:
        with pytest.raises(Exception, match="시스템 코어 상태\\(ID 0~9\\)는 삭제할 수 없습니다"):
            delete_mst_status(1, mock_db_session)

        status_rec = MstStatus(
            status_id=15,
            domain_category="ENTITY",
            status_name="검토중",
            attributes={"name_ja": "検討中"},
            is_active=True,
        )
        q_mock = MagicMock()
        q_mock.filter.return_value = q_mock
        q_mock.order_by.return_value.all.return_value = [status_rec]
        mock_db_session.query.return_value = q_mock

        opts = get_active_status_options("ENTITY", mock_db_session, "Japanese")
        assert opts["data"][0]["status_name"] == "検討中"


class TestPromptAndSchedulerServices:
    """prompt_service.py 및 scheduler_service.py 검증."""

    def test_prompt_crud_operations(self, mock_db_session: MagicMock) -> None:
        req = CreatePromptRequest(
            target_type="GLOBAL",
            target_value="ALL",
            pipeline_step="A_EXTRACTION",
            schema_name="HierarchicalFactSchema",
            system_prompt="테스트 프롬프트",
            temperature=0.3,
            max_length=1200,
            is_active=True,
        )
        c_res = create_prompt(req, mock_db_session)
        assert c_res["status"] == "success"

        prompt_rec = MstPrompt(
            prompt_id=10,
            target_type="GLOBAL",
            target_value="ALL",
            pipeline_step="A_EXTRACTION",
            schema_name="HierarchicalFactSchema",
            system_prompt="테스트 프롬프트",
            temperature=Decimal("0.30"),
            max_length=1200,
            is_active=True,
            up_ts=datetime(2026, 10, 15, 12, 0, 0),
            ne_ts=datetime(2026, 10, 15, 12, 0, 0),
        )
        q_mock = MagicMock()
        q_mock.filter.return_value = q_mock
        q_mock.count.return_value = 1
        q_mock.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            prompt_rec
        ]
        q_mock.first.return_value = prompt_rec
        mock_db_session.query.return_value = q_mock

        listed = get_prompts(mock_db_session, 1, 20, "GLOBAL", "A_EXTRACTION")
        assert listed["data"][0]["prompt_id"] == 10

        u_res = update_prompt(
            10,
            UpdatePromptRequest(
                target_type="GLOBAL",
                target_value="ALL",
                pipeline_step="A_EXTRACTION",
                schema_name="HierarchicalFactSchema",
                system_prompt="수정된 프롬프트",
                temperature=0.5,
                max_length=1500,
                is_active=True,
            ),
            mock_db_session,
        )
        assert u_res["status"] == "success"
        assert prompt_rec.system_prompt == "수정된 프롬프트"

        d_res = delete_prompt(10, mock_db_session)
        assert d_res["status"] == "success"

    @pytest.mark.asyncio
    async def test_scheduler_interval_and_advisory_lock_skip(self) -> None:
        with patch("services.scheduler_service.scheduler") as mock_sched:
            mock_job = MagicMock()
            mock_job.next_run_time = None
            mock_job.trigger.interval.total_seconds.return_value = 600
            mock_sched.get_job.return_value = mock_job

            cfg = get_ext_sync_interval()
            assert cfg["minutes"] == 10
            assert cfg["is_paused"] is True

            pause_res = update_ext_sync_interval(15, is_paused=True)
            assert pause_res["status"] == "success"
            mock_sched.pause_job.assert_called_once_with("ext_sync_job")

            resume_res = update_ext_sync_interval(15, is_paused=False)
            assert resume_res["status"] == "success"
            mock_sched.resume_job.assert_called_once_with("ext_sync_job")

        # 다른 워커가 Advisory Lock을 점유 중일 때 즉시 스킵하는지 검증
        mock_lock_db = MagicMock()
        mock_lock_db.__enter__.return_value = mock_lock_db
        mock_lock_db.execute.return_value.scalar.return_value = False

        with patch(
            "services.scheduler_service.SessionLocal", return_value=mock_lock_db
        ), patch("services.scheduler_service.process_ext_sync") as mock_proc:
            await run_ext_sync_job("AUTO")
            mock_proc.assert_not_called()