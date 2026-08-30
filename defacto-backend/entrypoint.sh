#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
python - << 'EOF'
import sys, psycopg2, os, time
db_url = os.getenv('DATABASE_URL', 'postgresql://erp_admin:erp_password@db:5432/defacto_db')
for i in range(30):
    try:
        conn = psycopg2.connect(db_url)
        conn.close()
        print('DB is ready!')
        sys.exit(0)
    except Exception as e:
        print(f'Waiting for db... {e}')
        time.sleep(2)
print('Failed to connect to db.')
sys.exit(1)
EOF

echo "Initializing Database Schemas & Extensions..."
python - << 'EOF'
import psycopg2, os, sys
db_url = os.getenv('DATABASE_URL', 'postgresql://erp_admin:erp_password@db:5432/defacto_db')
try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    # pgvector 익스텐션 및 필수 스키마 강제 생성
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cur.execute("CREATE SCHEMA IF NOT EXISTS core;")
    cur.execute("CREATE SCHEMA IF NOT EXISTS domain;")
    cur.execute("CREATE SCHEMA IF NOT EXISTS raw;")
    cur.execute("CREATE SCHEMA IF NOT EXISTS ext;")
    print('✅ Schemas and pgvector extension initialized successfully.')
    conn.close()
except Exception as e:
    print(f'❌ Error initializing database: {e}')
    sys.exit(1)
EOF

echo "Creating Tables from SQLAlchemy Models (Cold Start)..."
python - << 'EOF'
import sys, os, psycopg2
sys.path.append(os.getcwd())
from database.database import engine
from database.models import Base
try:
    # 1. models.py를 읽어 모든 테이블을 한 번에 생성 (오염된 Alembic 이력 무시)
    Base.metadata.create_all(bind=engine)
    print('✅ All tables created successfully from models.py.')
    
    # 2. 성능 최적화용 다국어 JSONB 수동 인덱스 추가 (Alembic 내역 보완)
    db_url = os.getenv('DATABASE_URL', 'postgresql://erp_admin:erp_password@db:5432/defacto_db')
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("CREATE INDEX IF NOT EXISTS ix_mst_entities_name_ja ON domain.mst_entities ((attributes->>'name_ja'))")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_mst_entities_name_en ON domain.mst_entities ((attributes->>'name_en'))")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_mst_objects_name_ja ON domain.mst_objects ((attributes->>'name_ja'))")
    cur.execute("CREATE INDEX IF NOT EXISTS ix_mst_objects_name_en ON domain.mst_objects ((attributes->>'name_en'))")
    conn.close()
    print('✅ Performance indexes created successfully.')
except Exception as e:
    print(f'❌ Error creating tables: {e}')
    sys.exit(1)
EOF

echo "Stamping Alembic to head (Bypassing legacy migration history)..."
alembic stamp head

echo "Seeding initial data..."
python seed.py

echo "Starting FastAPI server..."
exec uvicorn main:app --host 0.0.0.0 --port 8080