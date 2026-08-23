"""create_mst_prompts

Revision ID: l78m9n0o1p2q
Revises: k67l8m9n0o1p
Create Date: 2026-08-22 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'l78m9n0o1p2q'
down_revision: Union[str, Sequence[str], None] = 'k67l8m9n0o1p'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('mst_prompts',
        sa.Column('prompt_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False, comment="GLOBAL, ENTITY_TYPE, ENTITY_ID"),
        sa.Column('target_value', sa.String(length=50), nullable=False, comment="ALL, COMPANY, 1024 등"),
        sa.Column('pipeline_step', sa.String(length=50), nullable=False, comment="A_EXTRACTION, B_PLANNING 등"),
        sa.Column('schema_name', sa.String(length=100), nullable=False, comment="매핑할 Pydantic 스키마명"),
        sa.Column('system_prompt', sa.Text(), nullable=False, comment="LLM에 주입될 시스템 프롬프트"),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('up_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('prompt_id'),
        schema='domain'
    )

def downgrade() -> None:
    op.drop_table('mst_prompts', schema='domain')