"""create_sys_llm_metrics

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
Create Date: 2026-09-22 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'w2x3y4z5a6b7'
down_revision: Union[str, Sequence[str], None] = 'v1w2x3y4z5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 💡 [v0.3.4 Observability] LRSE 응답 메타데이터(토큰, 레이턴시, 재시도 횟수) 비동기 적재용 테이블 생성
    op.create_table(
        'sys_llm_metrics',
        sa.Column('metric_id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('base_entity_id', sa.BigInteger(), server_default='1024', nullable=False),
        sa.Column('correlation_id', sa.String(length=100), nullable=True, comment='분산 추적용 ID'),
        sa.Column('schema_name', sa.String(length=100), nullable=True, comment='요청된 스키마 이름'),
        sa.Column('latency_ms', sa.Integer(), server_default='0', nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('retry_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('metric_id'),
        schema='core',
    )
    op.create_index(
        'ix_sys_llm_metrics_tenant_created',
        'sys_llm_metrics',
        ['base_entity_id', 'created_at'],
        unique=False,
        schema='core',
    )


def downgrade() -> None:
    op.drop_index('ix_sys_llm_metrics_tenant_created', table_name='sys_llm_metrics', schema='core')
    op.drop_table('sys_llm_metrics', schema='core')