import os
import sys
import logging

sys.path.append(os.getcwd())
from database.database import SessionLocal
from database.models import MstEntity, MstStatus, MstObject

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_data():
    db = SessionLocal()
    try:
        # 1. 초기 시스템 상태값(Status) 세팅
        statuses = [
            {"id": 0, "cat": "SYSTEM", "name": "PENDING", "is_active": True},
            {"id": 1, "cat": "SYSTEM", "name": "SYNCED / ACTIVE", "is_active": True},
            {"id": 2, "cat": "SYSTEM", "name": "FAILED", "is_active": True},
            {"id": 9, "cat": "SYSTEM", "name": "DELETED", "is_active": False},
        ]
        for s in statuses:
            if not db.query(MstStatus).filter(MstStatus.status_id == s["id"]).first():
                db.add(MstStatus(
                    status_id=s["id"], 
                    domain_category=s["cat"], 
                    status_name=s["name"], 
                    is_active=s["is_active"]
                ))
        db.commit()

        # 2. 시스템 기본 대상 (ID 0) 세팅 (Foreign Key 제약 조건 통과용 💡)
        if not db.query(MstEntity).filter(MstEntity.entity_id == 0).first():
            db.add(MstEntity(
                entity_id=0,
                entity_type="SYSTEM",
                entity_name="Unknown Target",
                entity_status_id=1,
                attributes={"description": "System Default Target (ID: 0)"}
            ))
        
        if not db.query(MstObject).filter(MstObject.object_id == 0).first():
            db.add(MstObject(
                object_id=0,
                object_type="SYSTEM",
                object_name="Unknown Target",
                object_status_id=1,
                attributes={"description": "System Default Target (ID: 0)"}
            ))
        db.commit()

        # 3. 기본 Base Entity (1024) 세팅 (UI 기본값과 일치)
        base_entity = db.query(MstEntity).filter(MstEntity.entity_id == 1024).first()
        if not base_entity:
            db.add(MstEntity(
                entity_id=1024,
                entity_type="COMPANY",
                entity_name="Defacto HQ (Default Tenant)",
                entity_status_id=1,
                attributes={"description": "System Auto-Generated Default Tenant"}
            ))
            db.commit()
            logger.info("✅ 시드 데이터: 기본 시스템 구성이 성공적으로 완료되었습니다.")
        else:
            logger.info("✅ 시드 데이터: 기본 시스템 구성이 이미 존재합니다.")

    except Exception as e:
        logger.error(f"❌ 시드 데이터 생성 중 에러 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()