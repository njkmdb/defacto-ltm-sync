"""add_i18n_support

Revision ID: v1w2x3y4z5a6
Revises: u56v7w8x9y0z
Create Date: 2026-08-30 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'v1w2x3y4z5a6'
down_revision: Union[str, Sequence[str], None] = 'u56v7w8x9y0z'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 [i18n] mst_status 테이블에 다국어 및 확장 속성 저장을 위한 JSONB 컬럼 추가
    op.add_column('mst_status', sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True), schema='domain')
    
    # 💡 [i18n Performance] JSONB 내부 다국어 이름 필드(name_ja, name_en)에 대한 B-tree 인덱스 강제 적용 (Full Scan 방지)
    op.execute("CREATE INDEX ix_mst_entities_name_ja ON domain.mst_entities ((attributes->>'name_ja'))")
    op.execute("CREATE INDEX ix_mst_entities_name_en ON domain.mst_entities ((attributes->>'name_en'))")
    op.execute("CREATE INDEX ix_mst_objects_name_ja ON domain.mst_objects ((attributes->>'name_ja'))")
    op.execute("CREATE INDEX ix_mst_objects_name_en ON domain.mst_objects ((attributes->>'name_en'))")

def downgrade() -> None:
    # 롤백 시 인덱스 및 컬럼 제거
    op.execute("DROP INDEX IF EXISTS domain.ix_mst_objects_name_en")
    op.execute("DROP INDEX IF EXISTS domain.ix_mst_objects_name_ja")
    op.execute("DROP INDEX IF EXISTS domain.ix_mst_entities_name_en")
    op.execute("DROP INDEX IF EXISTS domain.ix_mst_entities_name_ja")
    op.drop_column('mst_status', 'attributes', schema='domain')