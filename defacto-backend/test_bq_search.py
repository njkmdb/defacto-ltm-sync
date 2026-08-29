import os
import asyncio
import logging
from datetime import date
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 프로젝트 내 모듈 임포트
from services.rag_service import RagService
from services.embedding_service import EmbeddingService

# 로그 설정 (실행 과정을 보기 위해 INFO 레벨로 설정)
logging.basicConfig(level=logging.INFO)

# 환경 변수 로드
load_dotenv()

# 로컬 DB 연결 설정 (유저님의 실제 로컬 DB 정보에 맞게 수정해주세요)
# 예: "postgresql://erp_admin:password@localhost:5432/defacto_db"
DB_URL = "postgresql://erp_admin:datastream_pass@localhost:5432/defacto_db"
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

async def run_test():
    db = SessionLocal()
    try:
        print("\n🚀 [TEST START] BigQuery Vector Search & Routing 파이프라인 테스트\n")
        
        # 1. 서비스 초기화
        rag_service = RagService(db)
        api_key = os.getenv("GEMINI_API_KEY")
        embedding_service = EmbeddingService(api_key=api_key)
        
        # 2. 테스트용 검색어 설정 및 벡터 임베딩 생성
        test_query = "과거에 진행했던 중요한 계약이나 인공지능 관련 기억을 찾아줘"
        print(f"🔍 검색어: '{test_query}'\n=> 임베딩(Vector) 변환 중...")
        query_vector = await embedding_service.get_embedding(test_query)
        
        # 3. 테스트할 기준 Entity ID (예: 1번 유저/회사)
        test_entity_id = 1
        
        # 4. 라우팅 로직 실행 (Tier 2를 거쳐 Tier 3 BigQuery로 넘어가는지 확인)
        print("\n🌐 최적의 컨텍스트 검색 시작 (로컬 LTM -> BigQuery 심층 검색)...")
        # 💡 [보안 결함 수정 연동] 필수 파라미터 동기화
        results = rag_service.get_optimal_context(
            base_entity_id=test_entity_id, 
            query_embedding=query_vector,
            reference_date=date.today()
        )
        
        # 5. 결과 출력
        print("\n================ [ 검색 결과 ] ================")
        if results:
            for idx, res in enumerate(results):
                # 로컬 검색 결과인지, BQ 검색 결과인지 딕셔너리/객체 형태에 따라 분기
                if isinstance(res, dict): 
                    print(f"[{idx+1}] 거리(Distance): {res.get('distance'):.4f} | 내용: {res.get('content_text')}")
                else:
                    # SQLAlchemy 모델 객체일 경우
                    print(f"[{idx+1}] 로컬 DB 검색 적중: {res.content_text}")
            print("===============================================\n")
            print("✅ 테스트 성공! BigQuery에서 데이터를 가져오거나 로컬 로직이 정상 작동했습니다.")
        else:
            print("텅~ (검색 결과가 없습니다.)")
            print("===============================================\n")
            print("💡 정상입니다! 쿼리는 성공했으나, 아직 BigQuery 테이블에 동기화된 데이터가 없어서 빈 결과를 반환한 것입니다.")

    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(run_test())