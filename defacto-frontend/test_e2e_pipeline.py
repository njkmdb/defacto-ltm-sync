import asyncio
import httpx
import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DB_URL = "postgresql://erp_admin:erp_password@localhost:5432/defacto_db"
API_BASE_URL = "http://localhost:8080/api/v1/core"

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TEST_BASE_ENTITY_ID = 1024
TEST_TARGET_ENTITY_ID = 9991
TEST_DATE = "2026-08-20"

# 💡 [i18n] 타겟 이름을 일본어로 변경
UNIQUE_TARGET_NAME = "E2E_アルファオメガ_ソリューションズ"

async def run_e2e_test():
    db = SessionLocal()
    # 💡 [i18n] 헤더에 x-target-language 를 주입하여 일본어 출력 시나리오 강제 테스트
    client = httpx.AsyncClient(
        base_url=API_BASE_URL, 
        timeout=30.0,
        headers={"x-target-language": "Japanese"}
    )
    raw_id = None

    try:
        print("\n🚀 [E2E TEST START] Defacto LTM-Sync 파이프라인 통합 테스트 (Bulk & Scheduler & i18n 포함)\n")

        print("▶ Step 0: 마스터 데이터 검증 및 주입")
        db.execute(text(f"""
            INSERT INTO domain.mst_entities (entity_id, entity_type, entity_name, entity_status_id, ne_ts, up_ts)
            VALUES 
            ({TEST_BASE_ENTITY_ID}, 'USER', 'E2E_테스트_주체', 1, NOW(), NOW()),
            ({TEST_TARGET_ENTITY_ID}, 'COMPANY', '{UNIQUE_TARGET_NAME}', 1, NOW(), NOW())
            ON CONFLICT (entity_id) DO UPDATE 
            SET entity_name = EXCLUDED.entity_name;
        """))
        db.commit()
        print(f"  ✅ 베이스 엔티티({TEST_BASE_ENTITY_ID}), 타겟 엔티티({TEST_TARGET_ENTITY_ID}) 모의 주입 완료.\n")

        print("▶ Step 1: 스케줄러 수동 실행 (EXT 정형 데이터 수집 모사)")
        res = await client.post("/scheduler/force-sync")
        res.raise_for_status()
        print("  ⏳ EXT 동기화 백그라운드 처리 대기 중... (5초)")
        time.sleep(5)
        
        # 💡 [스키마 변경 대응] ext_sync_history -> history_ext_sync
        history = db.execute(text("SELECT status, records_fetched FROM core.history_ext_sync ORDER BY sync_id DESC LIMIT 1")).fetchone()
        assert history is not None and history[0] == "SUCCESS", "EXT 동기화가 실패했거나 실행되지 않았습니다."
        print(f"  ✅ [DB 검증 통과] EXT 동기화 성공. 수집된 레코드 수: {history[1]}\n")

        print("▶ Step 2: 비정형 데이터 수동 적재 (Create) 및 파이프라인 즉시 가동")
        
        # 💡 [i18n] 원문을 일본어로 주입
        create_payload = {
            "base_entity_id": TEST_BASE_ENTITY_ID,
            "event_date": TEST_DATE,
            "raw_content": f"{UNIQUE_TARGET_NAME}との新規契約について協議した。単価交渉が必要である。",
            "run_pipeline_now": True,
            "schema_name": "HierarchicalFactSchema"
        }
        res = await client.post("/raw-events", json=create_payload)
        res.raise_for_status()
        raw_id = res.json().get("raw_id")
        print(f"  ✅ API 호출 성공! 발급된 raw_id: {raw_id}")
        
        print("  ⏳ 백그라운드 파이프라인 처리 대기 중... (15초)")
        time.sleep(15)

        status = db.execute(text("SELECT sync_status_id FROM raw.event_raw WHERE raw_id = :raw_id"), {"raw_id": raw_id}).scalar()
        # 💡 [스키마 변경 대응] fact_sales_log -> event_facts
        facts = db.execute(text("SELECT event_id FROM core.event_facts WHERE raw_id = :raw_id"), {"raw_id": raw_id}).fetchall()
        assert len(facts) > 0, "팩트 데이터가 생성되지 않았습니다."
        fact_id = facts[0][0]

        # 💡 [스키마 변경 대응] dim_memory_index -> event_memories
        memories = db.execute(text("SELECT memory_id, target_entity_id FROM core.event_memories WHERE source_event_ids @> :fact_id_json"), {"fact_id_json": f"[{fact_id}]"}).fetchall()
        assert status == 1, f"상태 코드가 1(SYNCED)이 아닙니다. 현재 상태: {status}"
        assert len(memories) > 0, f"생성된 벡터 메모리가 없거나 event_id({fact_id})가 매핑되지 않았습니다."
        assert memories[0][1] == TEST_TARGET_ENTITY_ID, f"LLM이 타겟 엔티티 ID를 매핑하지 못했습니다! 기대값: {TEST_TARGET_ENTITY_ID}, 실제값: {memories[0][1]}"
        print(f"  ✅ [DB 검증 통과] 상태코드: {status}, 생성된 메모리 수: {len(memories)}, 타겟 매핑 성공.\n")

        print("▶ Step 3: 일괄 컨텍스트 합성 (Bulk Synthesize) 트리거 및 Polling 검증")
        bulk_payload = {"reference_date": TEST_DATE}
        res = await client.post("/bulk-synthesize", json=bulk_payload)
        res.raise_for_status()
        job_id = res.json().get("job_id")
        total_count = res.json().get("total_count")
        print(f"  ✅ Bulk Job 생성 성공! Job ID: {job_id} (총 대상: {total_count}건)")
        
        max_retries = 15
        job_completed = False
        for i in range(max_retries):
            poll_res = await client.get(f"/batch-jobs/{job_id}")
            poll_res.raise_for_status()
            job_status = poll_res.json()
            print(f"  ⏳ Polling [{i+1}/{max_retries}] 진행률: {job_status['current_count']}/{job_status['total_count']} ({job_status['status']})")
            
            if job_status['status'] == 'COMPLETED':
                job_completed = True
                break
            elif job_status['status'] == 'FAILED':
                raise Exception(f"일괄 합성이 실패했습니다: {job_status.get('error_log')}")
            
            time.sleep(3)

        assert job_completed, "일괄 합성이 제한 시간 내에 완료되지 않았습니다."
        print("  ✅ [검증 통과] 일괄 합성 배치가 성공적으로 완료되었습니다.\n")
        
        logs = db.execute(text("SELECT count(*) FROM core.event_logs WHERE log_date = :date"), {"date": TEST_DATE}).scalar()
        assert logs > 0, "생성된 AI 일지(Event Log)가 없습니다."
        print(f"  ✅ [DB 검증 통과] 해당 일자의 AI 일지가 총 {logs}건 생성/갱신 되었습니다.\n")

        print("🎉 [E2E TEST SUCCESS] 스케줄러, 일괄 처리, EXT 수집을 포함한 모든 파이프라인이 완벽하게 통과되었습니다!")

    except AssertionError as ae:
        print(f"\n❌ [Assertion Error] 테스트 검증 실패: {ae}")
    except Exception as e:
        print(f"\n❌ [Exception] 런타임 오류 발생: {e}")
    finally:
        try:
            db.execute(text("DELETE FROM ext.ext_events WHERE base_entity_id = :bid"), {"bid": TEST_BASE_ENTITY_ID})
            db.execute(text("DELETE FROM ext.ext_mst WHERE base_entity_id = :bid"), {"bid": TEST_BASE_ENTITY_ID})
            db.commit()
        except Exception:
            pass
        db.close()
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run_e2e_test())