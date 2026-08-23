"""create_event_creations

Revision ID: o91p2q3r4s5t
Revises: n90o1p2q3r4s
Create Date: 2026-08-23 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'o91p2q3r4s5t'
down_revision: Union[str, Sequence[str], None] = 'n90o1p2q3r4s'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 2차 창작 엔진의 산출물을 보관하기 위한 event_creations 테이블 생성
    op.create_table('event_creations',
        sa.Column('creation_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('log_id', sa.BigInteger(), nullable=True),
        sa.Column('briefing_id', sa.BigInteger(), nullable=True),
        sa.Column('source_type', sa.String(length=20), nullable=False, comment="'LOG' 또는 'BRIEFING'"),
        sa.Column('base_entity_id', sa.BigInteger(), nullable=False),
        sa.Column('tone_name', sa.String(length=50), nullable=False, comment="적용된 톤앤매너 프리셋 이름"),
        sa.Column('creative_title', sa.String(length=200), nullable=False),
        sa.Column('creative_content', sa.Text(), nullable=False),
        sa.Column('up_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['base_entity_id'], ['domain.mst_entities.entity_id'], ),
        sa.ForeignKeyConstraint(['briefing_id'], ['core.event_briefings.briefing_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['log_id'], ['core.event_logs.log_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('creation_id'),
        sa.CheckConstraint('num_nonnulls(log_id, briefing_id) = 1', name='chk_exclusive_source'),
        schema='core'
    )

def downgrade() -> None:
    op.drop_table('event_creations', schema='core')