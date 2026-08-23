from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 접속 URL (실제 비밀번호로 수정해주세요)
SQLALCHEMY_DATABASE_URL = "postgresql://erp_admin:erp_password@localhost:5432/defacto_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()