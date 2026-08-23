"""add_temperature_to_prompts

Revision ID: p01q2r3s4t5u
Revises: o91p2q3r4s5t
Create Date: 2026-08-23 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'p01q2r3s4t5u'
down_revision: Union[str, Sequence[str], None] = 'o91p2q3r4s5t'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # mst_prompts 테이블에 temperature 컬럼 추가 (기본값 0.7)
    op.add_column('mst_prompts', sa.Column('temperature', sa.Numeric(precision=3, scale=2), server_default='0.70', nullable=False), schema='domain')

def downgrade() -> None:
    op.drop_column('mst_prompts', 'temperature', schema='domain')