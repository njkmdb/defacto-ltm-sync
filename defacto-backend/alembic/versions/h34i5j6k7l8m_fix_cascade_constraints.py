"""fix_cascade_constraints

Revision ID: h34i5j6k7l8m
Revises: g23h4j5k6l7m
Create Date: 2026-08-21 21:50:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'h34i5j6k7l8m'
down_revision: Union[str, Sequence[str], None] = 'g23h4j5k6l7m'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 💡 [치명적 버그 수정] 물리적 DB 제약조건을 ON DELETE CASCADE로 강제 교체
    op.drop_constraint('event_facts_raw_id_fkey', 'event_facts', schema='core', type_='foreignkey')
    op.create_foreign_key(
        'event_facts_raw_id_fkey', 
        'event_facts', 
        'event_raw', 
        ['raw_id'], 
        ['raw_id'], 
        source_schema='core', 
        referent_schema='raw', 
        ondelete='CASCADE'
    )

def downgrade() -> None:
    # 롤백 시 원래 상태(SET NULL)로 복구
    op.drop_constraint('event_facts_raw_id_fkey', 'event_facts', schema='core', type_='foreignkey')
    op.create_foreign_key(
        'event_facts_raw_id_fkey', 
        'event_facts', 
        'event_raw', 
        ['raw_id'], 
        ['raw_id'], 
        source_schema='core', 
        referent_schema='raw', 
        ondelete='SET NULL'
    )