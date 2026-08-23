"""create_batch_and_sync_tables

Revision ID: m89n0o1p2q3r
Revises: l78m9n0o1p2q
Create Date: 2026-08-22 17:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'm89n0o1p2q3r'
down_revision: Union[str, Sequence[str], None] = 'l78m9n0o1p2q'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. 일괄 합성 처리 진행률 관리를 위한 batch_jobs 테이블 생성
    op.create_table('batch_jobs',
        sa.Column('job_id', sa.String(length=50), nullable=False),
        sa.Column('job_type', sa.String(length=50), nullable=False, comment="BULK_SYNTHESIS 등"),
        sa.Column('status', sa.String(length=20), nullable=False, comment="PENDING, RUNNING, COMPLETED, FAILED"),
        sa.Column('total_count', sa.Integer(), default=0, nullable=False),
        sa.Column('current_count', sa.Integer(), default=0, nullable=False),
        sa.Column('error_log', sa.Text(), nullable=True),
        sa.Column('up_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('job_id'),
        schema='core'
    )

    # 2. 외부 데이터 마이크로 배치 이력 관리를 위한 ext_sync_history 테이블 생성
    op.create_table('ext_sync_history',
        sa.Column('sync_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('sync_type', sa.String(length=20), nullable=False, comment="AUTO, MANUAL"),
        sa.Column('status', sa.String(length=20), nullable=False, comment="RUNNING, SUCCESS, FAILED"),
        sa.Column('records_fetched', sa.Integer(), default=0, nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('start_ts', sa.DateTime(), nullable=False),
        sa.Column('end_ts', sa.DateTime(), nullable=True),
        sa.Column('up_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('ne_ts', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('sync_id'),
        schema='core' # 💡 [결함 수정] 백엔드가 기록할 수 있도록 ext에서 core로 스키마 이전
    )

def downgrade() -> None:
    op.drop_table('ext_sync_history', schema='core')
    op.drop_table('batch_jobs', schema='core')