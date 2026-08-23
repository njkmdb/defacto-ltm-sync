"""create_ext_schema

Revision ID: j56k7l8m9n0o
Revises: i45j6k7l8m9n
Create Date: 2026-08-22 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'j56k7l8m9n0o'
down_revision: Union[str, Sequence[str], None] = 'i45j6k7l8m9n'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 [EPIC 1] EXT 스키마 생성 및 권한 설정 (방어적 설계)
    op.execute('CREATE SCHEMA IF NOT EXISTS ext')
    op.execute('GRANT USAGE ON SCHEMA ext TO erp_admin')

    # 1. ext_mst 범용 마스터 테이블 생성
    op.create_table('ext_mst',
        sa.Column('ext_mst_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('base_entity_id', sa.BigInteger(), nullable=False),
        sa.Column('ext_source', sa.String(length=50), nullable=False, comment='데이터 출처 (예: ERP, CRM)'),
        sa.Column('ext_type', sa.String(length=50), nullable=False, comment='데이터 유형 (예: CUSTOMER_GRADE, SALES_METRIC)'),
        sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='범용 정형 속성'),
        sa.Column('up_ts', sa.DateTime(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('ext_mst_id'),
        schema='ext'
    )

    # 2. ext_events 범용 이벤트 테이블 생성
    op.create_table('ext_events',
        sa.Column('ext_event_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('base_entity_id', sa.BigInteger(), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=False),
        sa.Column('ext_source', sa.String(length=50), nullable=False, comment='데이터 출처'),
        sa.Column('event_type', sa.String(length=50), nullable=False, comment='이벤트 유형 (예: ORDER, INVOICE, CLAIM)'),
        sa.Column('event_amount', sa.Numeric(precision=15, scale=2), nullable=True, comment='관련 금액 (선택)'),
        sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True, comment='기타 범용 속성'),
        sa.Column('up_ts', sa.DateTime(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('ext_event_id'),
        schema='ext'
    )

    # 💡 [EPIC 1] 해당 테이블들에 대해 SELECT 권한만 명시적으로 부여 (Read-Only)
    op.execute('GRANT SELECT ON ALL TABLES IN SCHEMA ext TO erp_admin')

def downgrade() -> None:
    op.drop_table('ext_events', schema='ext')
    op.drop_table('ext_mst', schema='ext')
    op.execute('DROP SCHEMA IF EXISTS ext CASCADE')