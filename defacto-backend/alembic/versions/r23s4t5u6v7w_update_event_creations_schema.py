"""update_event_creations_schema

Revision ID: r23s4t5u6v7w
Revises: q12r3s4t5u6v
Create Date: 2026-08-23 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'r23s4t5u6v7w'
down_revision: Union[str, Sequence[str], None] = 'q12r3s4t5u6v'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 기존 단일 식별자 및 외래키/제약 조건 삭제
    op.drop_constraint('event_creations_log_id_fkey', 'event_creations', schema='core', type_='foreignkey')
    op.drop_constraint('event_creations_briefing_id_fkey', 'event_creations', schema='core', type_='foreignkey')
    op.drop_constraint('chk_exclusive_source', 'event_creations', schema='core')
    
    op.drop_column('event_creations', 'log_id', schema='core')
    op.drop_column('event_creations', 'briefing_id', schema='core')
    op.drop_column('event_creations', 'source_type', schema='core')

    # 다중 식별자 JSONB 컬럼 추가
    op.add_column('event_creations', sa.Column('source_log_ids', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False), schema='core')
    op.add_column('event_creations', sa.Column('source_briefing_ids', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False), schema='core')
    op.add_column('event_creations', sa.Column('source_creation_ids', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False), schema='core')

def downgrade() -> None:
    pass # 데이터 유실 방지를 위해 다운그레이드는 구현 생략