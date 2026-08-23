"""apply_hierarchical_ltm

Revision ID: g23h4j5k6l7m
Revises: f1ed3329d581
Create Date: 2026-08-21 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector
from sqlalchemy.dialects import postgresql

revision: str = 'g23h4j5k6l7m'
down_revision: Union[str, Sequence[str], None] = 'f1ed3329d581'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. 사용하지 않는 구형 도메인 템플릿 테이블 완전 삭제
    op.execute('DROP TABLE IF EXISTS domain.fact_item_template CASCADE')
    op.execute('DROP TABLE IF EXISTS domain.fact_header_template CASCADE')
    op.execute('DROP TABLE IF EXISTS domain.fact_activity_template CASCADE')

    # 2. Detail 계층 (대뇌피질): event_facts 컬럼 추가
    op.execute("ALTER TABLE core.event_facts ADD COLUMN fact_content TEXT DEFAULT '' NOT NULL")
    op.execute("ALTER TABLE core.event_facts ADD COLUMN attributes JSONB DEFAULT '{}'")

    # 3. Index 계층 (해마): event_memories 컬럼 추가
    op.execute("ALTER TABLE core.event_memories ADD COLUMN core_keywords JSONB DEFAULT '[]'")

    # 4. 핵심 키워드 GIN 인덱스 강제 적용 (HNSW 인덱스는 차원수 초과 및 Exact Search 채택으로 제외)
    op.execute("CREATE INDEX ix_event_memories_keywords_gin ON core.event_memories USING gin (core_keywords)")

def downgrade() -> None:
    # 1. 인덱스 삭제
    op.execute("DROP INDEX IF EXISTS core.ix_event_memories_keywords_gin")

    # 2. 추가되었던 컬럼 삭제
    op.drop_column('event_memories', 'core_keywords', schema='core')
    op.drop_column('event_facts', 'attributes', schema='core')
    op.drop_column('event_facts', 'fact_content', schema='core')