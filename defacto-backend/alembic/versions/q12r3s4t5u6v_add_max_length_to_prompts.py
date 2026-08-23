"""add_max_length_to_prompts

Revision ID: q12r3s4t5u6v
Revises: p01q2r3s4t5u
Create Date: 2026-08-23 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'q12r3s4t5u6v'
down_revision: Union[str, Sequence[str], None] = 'p01q2r3s4t5u'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # mst_prompts 테이블에 max_length 컬럼 추가 (기본값 1000)
    op.add_column('mst_prompts', sa.Column('max_length', sa.Integer(), server_default='1000', nullable=False), schema='domain')

def downgrade() -> None:
    op.drop_column('mst_prompts', 'max_length', schema='domain')