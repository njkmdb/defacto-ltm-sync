"""create_mst_pipelines

Revision ID: u56v7w8x9y0z
Revises: t45u6v7w8x9y
Create Date: 2026-08-28 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'u56v7w8x9y0z'
down_revision: Union[str, Sequence[str], None] = 't45u6v7w8x9y'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('mst_pipelines',
        sa.Column('pipeline_id', sa.String(length=50), nullable=False),
        sa.Column('pipeline_name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('config_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]', comment='조립된 steps 배열 전체를 보관'),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('up_ts', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('pipeline_id'),
        schema='domain'
    )

def downgrade() -> None:
    op.drop_table('mst_pipelines', schema='domain')