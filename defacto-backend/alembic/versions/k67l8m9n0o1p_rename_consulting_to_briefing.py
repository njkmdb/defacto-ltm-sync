"""rename_consulting_to_briefing

Revision ID: k67l8m9n0o1p
Revises: j56k7l8m9n0o
Create Date: 2026-08-22 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'k67l8m9n0o1p'
down_revision: Union[str, Sequence[str], None] = 'j56k7l8m9n0o'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. 테이블명 변경
    op.rename_table('consulting_reports', 'event_briefings', schema='core')
    
    # 2. PK 컬럼명 변경
    op.alter_column('event_briefings', 'report_id', new_column_name='briefing_id', schema='core')
    
    # 3. 제약 조건 및 시퀀스명 변경 (PostgreSQL 특화)
    op.execute('ALTER SEQUENCE core.consulting_reports_report_id_seq RENAME TO event_briefings_briefing_id_seq')
    op.execute('ALTER TABLE core.event_briefings RENAME CONSTRAINT consulting_reports_pkey TO event_briefings_pkey')
    op.execute('ALTER TABLE core.event_briefings RENAME CONSTRAINT consulting_reports_base_entity_id_fkey TO event_briefings_base_entity_id_fkey')

def downgrade() -> None:
    op.execute('ALTER TABLE core.event_briefings RENAME CONSTRAINT event_briefings_base_entity_id_fkey TO consulting_reports_base_entity_id_fkey')
    op.execute('ALTER TABLE core.event_briefings RENAME CONSTRAINT event_briefings_pkey TO consulting_reports_pkey')
    op.execute('ALTER SEQUENCE core.event_briefings_briefing_id_seq RENAME TO consulting_reports_report_id_seq')
    op.alter_column('event_briefings', 'briefing_id', new_column_name='report_id', schema='core')
    op.rename_table('event_briefings', 'consulting_reports', schema='core')