import asyncio
import logging
from datetime import date
from typing import List
from sqlalchemy import text
from database.database import SessionLocal

from database.models import MstPipeline
from schemas.pipeline_schemas import PipelineExecutionRequest, PipelineStep, SynthesizeContextRequest
from schemas.api_schemas import SaveSummaryRequest
from services.synthesis_service import process_synthesize_context
from services.log_service import save_edited_summary
from services.pipeline_core import PipelineOrchestrator
from services.pipeline_nodes import build_node_registry

logger = logging.getLogger(__name__)

async def bulk_synthesize_task(job_id: str, reference_date: date, entity_ids: List[int], pipeline_id: str = None, target_lang: str = "Korean"):
    sem = asyncio.Semaphore(3)
    
    preset_steps = []
    if pipeline_id:
        with SessionLocal() as db:
            preset = db.query(MstPipeline).filter(MstPipeline.pipeline_id == pipeline_id).first()
            if preset and preset.is_active:
                preset_steps = [PipelineStep(**step) for step in preset.config_json]

    async def _safe_process(entity_id: int):
        async with sem:
            try:
                with SessionLocal() as db:
                    if pipeline_id and preset_steps:
                        orchestrator = PipelineOrchestrator(db)
                        for name, node in build_node_registry().items():
                            orchestrator.register_node(name, node)
                            
                        request = PipelineExecutionRequest(
                            pipeline_id=pipeline_id,
                            base_entity_id=entity_id,
                            initial_context={
                                "reference_date": reference_date.isoformat(), 
                                "query_text": "최근 발생한 중요 이벤트 및 비즈니스 활동 이력 검색", 
                                "use_deep_search": False, 
                                "use_pre_fact_check": True,
                                "target_lang": target_lang
                            },
                            steps=[]
                        )
                        await orchestrator.execute(request)
                        db.commit() 
                    else:
                        request = SynthesizeContextRequest(
                            base_entity_id=entity_id,
                            reference_date=reference_date,
                            schema_name="ContextSynthesisSchema",
                            use_deep_search=False
                        )
                        res = await process_synthesize_context(request, db, target_lang)
                        
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