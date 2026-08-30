import sys
import os
from datetime import date

# 현재 디렉토리를 경로에 추가하여 database 모듈을 찾을 수 있게 함
sys.path.append(os.getcwd())
from database.database import SessionLocal
from database.models import ExtEvent

def inject_fake_erp():
    db = SessionLocal()
    try:
        # 가짜 ERP 정형 데이터 생성
        fake_erp = ExtEvent(
            base_entity_id=1024,
            event_date=date.today(),
            ext_source="ERP_SYSTEM",
            event_type="CONTRACT",
            event_amount=3000000,  # 💡 여기에 300만 원 세팅!
            attributes={"target_name": "미래통상", "memo": "미래통상 초기 계약금액 확정건"}
        )
        db.add(fake_erp)
        db.commit()
        print("✅ 삐빅- [미래통상 계약 금액: 3,000,000원] 가짜 ERP 데이터가 ext.ext_events 테이블에 완벽히 은닉되었습니다!")
    except Exception as e:
        db.rollback()
        print(f"❌ 에러 발생: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    inject_fake_erp()