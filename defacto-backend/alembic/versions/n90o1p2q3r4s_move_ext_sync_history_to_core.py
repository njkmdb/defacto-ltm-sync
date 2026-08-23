"""move_ext_sync_history_to_core

Revision ID: n90o1p2q3r4s
Revises: m89n0o1p2q3r
Create Date: 2026-08-23 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'n90o1p2q3r4s'
down_revision: Union[str, Sequence[str], None] = 'm89n0o1p2q3r'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 [결함 수정] 이미 ext 스키마에 생성되어 있던 ext_sync_history 테이블을 
    # 백엔드가 Write 할 수 있도록 core 스키마로 물리적으로 이동시킵니다.
    op.execute('ALTER TABLE IF EXISTS ext.ext_sync_history SET SCHEMA core')

def downgrade() -> None:
    # 롤백 시 원래 스키마(ext)로 복원
    op.execute('ALTER TABLE IF EXISTS core.ext_sync_history SET SCHEMA ext')