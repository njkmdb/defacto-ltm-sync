import os
import sys
from datetime import date, datetime
from typing import Generator, List
from unittest.mock import MagicMock

import pytest

# defacto-backend 루트 경로를 sys.path 최상단에 등록
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# 모듈 임포트 전 필수 환경변수 강제 세팅 (psycopg2 드라이버 명시 및 NoneType 에러 원천 차단)
os.environ["DATABASE_URL"] = "postgresql+psycopg2://user:password@localhost:5432/defacto_test"
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-api-key")
os.environ.setdefault("MODEL_NAME", "auto")
os.environ.setdefault("LRSE_URL", "http://127.0.0.1:8081")
os.environ.setdefault("SESSION_ID", "test-session-id")
os.environ.setdefault("SESSION_SECRET", "test-session-secret")
os.environ.setdefault("USE_BIGQUERY", "False")
os.environ.setdefault("GCP_PROJECT_ID", "test-gcp-project")

from database.models import EventMemory, MstEntity, MstPrompt


@pytest.fixture
def mock_db_session() -> Generator[MagicMock, None, None]:
    """
    SQLAlchemy Session 및 begin_nested() Savepoint 컨텍스트 매니저를 모사하는 픽스처.
    """
    session = MagicMock()
    nested_tx = MagicMock()
    nested_tx.__enter__.return_value = nested_tx
    nested_tx.__exit__.return_value = None
    session.begin_nested.return_value = nested_tx
    yield session


@pytest.fixture
def sample_vector_3072() -> List[float]:
    """gemini-embedding-001 규격의 3072차원 테스트용 정규화 더미 벡터."""
    return [0.001] * 3072


@pytest.fixture
def sample_ltm_memories(sample_vector_3072: List[float]) -> List[EventMemory]:
    """테넌트(1024)에 속한 샘플 EventMemory 엔티티 리스트."""
    return [
        EventMemory(
            memory_id=101,
            base_entity_id=1024,
            target_entity_id=9991,
            target_object_id=0,
            event_date=date(2026, 8, 15),
            memory_type="LTM",
            content_text="알파오메가 솔루션즈와 단가 인하(300만 원) 협상 진행",
            core_keywords=["단가 인하", "계약", "알파오메가"],
            embedding=sample_vector_3072,
            source_event_ids=[501, 502],
            ne_ts=datetime(2026, 8, 15, 10, 0, 0),
        ),
        EventMemory(
            memory_id=102,
            base_entity_id=1024,
            target_entity_id=9992,
            target_object_id=0,
            event_date=date(2026, 8, 1),
            memory_type="LTM",
            content_text="미래통상 클레임 대응 및 납기일 조정 합의",
            core_keywords=["클레임", "납기일", "미래통상"],
            embedding=sample_vector_3072,
            source_event_ids=[503],
            ne_ts=datetime(2026, 8, 1, 14, 30, 0),
        ),
    ]