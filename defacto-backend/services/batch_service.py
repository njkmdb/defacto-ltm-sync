import asyncio
import logging
from datetime import date
from typing import List
from sqlalchemy import text
from database.database import SessionLocal
from schemas.api_schemas import SynthesizeContextRequest, SaveSummaryRequest
from services.synthesis_service import process_synthesize_context
from services.log_service import save_edited_summary

logger = logging.getLogger(__name__)

async def bulk_synthesize_task(job_id: str, reference_date: date, entity_ids: List[int]):
    sem = asyncio.Semaphore(3)
    
    async def _safe_process(entity_id: int):
        async with sem:
            try:
                with SessionLocal() as db:
                    request = SynthesizeContextRequest(
                        base_entity_id=entity_id,
                        reference_date=reference_date,
                        schema_name="ContextSynthesisSchema",
                        use_deep_search=False
                    )
                    res = await process_synthesize_context(request, db)
                    
                    if res.data.log_id != 0: 
                        save_req = SaveSummaryRequest(
                            base_entity_id=entity_id,
                            reference_date=reference_date,
                            edited_summary=res.data.synthesized_data.llm_summary,
                            action_items=res.data.synthesized_data.action_items,
                            schema_name="ContextSynthesisSchema"
                        )
                        save_edited_summary(save_req, db)
                        
            except Exception as e:
                logger.error(f"[Bulk Synthesize] 주체 {entity_id} 처리 실패: {e}")
                with SessionLocal() as log_db:
                    error_str = f"[{entity_id}] {str(e)}\n"
                    log_db.execute(
                        text("UPDATE core.batch_jobs SET error_log = COALESCE(error_log, '') || :err WHERE job_id = :id"), 
                        {"err": error_str, "id": job_id}
                    )
                    log_db.commit()
            finally:
                with SessionLocal() as progress_db:
                    progress_db.execute(
                        text("UPDATE core.batch_jobs SET current_count = current_count + 1 WHERE job_id = :id"), 
                        {"id": job_id}
                    )
                    progress_db.commit()

    await asyncio.gather(*[_safe_process(e_id) for e_id in entity_ids])
    
    with SessionLocal() as final_db:
        final_db.execute(text("UPDATE core.batch_jobs SET status = 'COMPLETED' WHERE job_id = :id"), {"id": job_id})
        final_db.commit()