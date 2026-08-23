"""rename_tables_rollback

Revision ID: t45u6v7w8x9y
Revises: s34t5u6v7w8x
Create Date: 2026-08-23 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 't45u6v7w8x9y'
down_revision: Union[str, Sequence[str], None] = 's34t5u6v7w8x'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 테이블명 변경 (schema 명시)
    op.rename_table('fact_sales_log', 'event_facts', schema='core')
    op.rename_table('dim_memory_index', 'event_memories', schema='core')
    op.rename_table('ext_sync_history', 'history_ext_sync', schema='core')

    # 💡 시퀀스명 동기화
    op.execute('ALTER SEQUENCE core.fact_sales_log_event_id_seq RENAME TO event_facts_event_id_seq')
    op.execute('ALTER SEQUENCE core.dim_memory_index_memory_id_seq RENAME TO event_memories_memory_id_seq')
    op.execute('ALTER SEQUENCE core.ext_sync_history_sync_id_seq RENAME TO history_ext_sync_sync_id_seq')

    # 💡 PK 제약 조건 동기화
    op.execute('ALTER TABLE core.event_facts RENAME CONSTRAINT fact_sales_log_pkey TO event_facts_pkey')
    op.execute('ALTER TABLE core.event_memories RENAME CONSTRAINT dim_memory_index_pkey TO event_memories_pkey')
    op.execute('ALTER TABLE core.history_ext_sync RENAME CONSTRAINT ext_sync_history_pkey TO history_ext_sync_pkey')

    # 💡 인덱스 동기화
    op.execute('ALTER INDEX core.ix_dim_memory_index_keywords_gin RENAME TO ix_event_memories_keywords_gin')


def downgrade() -> None:
    # 💡 가역성을 위한 롤백 로직 (인덱스 -> PK -> 시퀀스 -> 테이블명 순)
    op.execute('ALTER INDEX core.ix_event_memories_keywords_gin RENAME TO ix_dim_memory_index_keywords_gin')

    op.execute('ALTER TABLE core.history_ext_sync RENAME CONSTRAINT history_ext_sync_pkey TO ext_sync_history_pkey')
    op.execute('ALTER TABLE core.event_memories RENAME CONSTRAINT event_memories_pkey TO dim_memory_index_pkey')
    op.execute('ALTER TABLE core.event_facts RENAME CONSTRAINT event_facts_pkey TO fact_sales_log_pkey')

    op.execute('ALTER SEQUENCE core.history_ext_sync_sync_id_seq RENAME TO ext_sync_history_sync_id_seq')
    op.execute('ALTER SEQUENCE core.event_memories_memory_id_seq RENAME TO dim_memory_index_memory_id_seq')
    op.execute('ALTER SEQUENCE core.event_facts_event_id_seq RENAME TO fact_sales_log_event_id_seq')

    op.rename_table('history_ext_sync', 'ext_sync_history', schema='core')
    op.rename_table('event_memories', 'dim_memory_index', schema='core')
    op.rename_table('event_facts', 'fact_sales_log', schema='core')