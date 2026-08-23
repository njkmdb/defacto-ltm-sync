"""create_consulting_reports

Revision ID: i45j6k7l8m9n
Revises: h34i5j6k7l8m
Create Date: 2026-08-22 10:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'i45j6k7l8m9n'
down_revision: Union[str, Sequence[str], None] = 'h34i5j6k7l8m'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('consulting_reports',
        sa.Column('report_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('base_entity_id', sa.BigInteger(), nullable=False),
        sa.Column('query_text', sa.String(length=500), nullable=False),
        sa.Column('executive_summary', sa.Text(), nullable=False),
        sa.Column('key_findings', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('risk_and_warnings', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('recommended_actions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('source_memory_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('up_ts', sa.DateTime(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['base_entity_id'], ['domain.mst_entities.entity_id'], ),
        sa.PrimaryKeyConstraint('report_id'),
        schema='core'
    )

def downgrade() -> None:
    op.drop_table('consulting_reports', schema='core')