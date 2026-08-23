"""rename_tables_to_defacto_cm

Revision ID: s34t5u6v7w8x
Revises: r23s4t5u6v7w
Create Date: 2026-08-23 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 's34t5u6v7w8x'
down_revision: Union[str, Sequence[str], None] = 'r23s4t5u6v7w'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 [Defacto CM 동기화] 물리적 테이블명 변경
    op.rename_table('event_facts', 'fact_sales_log', schema='core')
    op.rename_table('event_memories', 'dim_memory_index', schema='core')
    
    # 💡 관련 시퀀스명 동기화
    op.execute('ALTER SEQUENCE core.event_facts_event_id_seq RENAME TO fact_sales_log_event_id_seq')
    op.execute('ALTER SEQUENCE core.event_memories_memory_id_seq RENAME TO dim_memory_index_memory_id_seq')
    
    # 💡 관련 제약 조건 및 인덱스 동기화
    op.execute('ALTER TABLE core.fact_sales_log RENAME CONSTRAINT event_facts_pkey TO fact_sales_log_pkey')
    op.execute('ALTER TABLE core.dim_memory_index RENAME CONSTRAINT event_memories_pkey TO dim_memory_index_pkey')
    op.execute('ALTER INDEX core.ix_event_memories_keywords_gin RENAME TO ix_dim_memory_index_keywords_gin')

def downgrade() -> None:
    op.execute('ALTER INDEX core.ix_dim_memory_index_keywords_gin RENAME TO ix_event_memories_keywords_gin')
    op.execute('ALTER TABLE core.dim_memory_index RENAME CONSTRAINT dim_memory_index_pkey TO event_memories_pkey')
    op.execute('ALTER TABLE core.fact_sales_log RENAME CONSTRAINT fact_sales_log_pkey TO event_facts_pkey')
    
    op.execute('ALTER SEQUENCE core.dim_memory_index_memory_id_seq RENAME TO event_memories_memory_id_seq')
    op.execute('ALTER SEQUENCE core.fact_sales_log_event_id_seq RENAME TO event_facts_event_id_seq')
    
    op.rename_table('dim_memory_index', 'event_memories', schema='core')
    op.rename_table('fact_sales_log', 'event_facts', schema='core')