import math
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import MstPipeline
from schemas.pipeline_schemas import PipelineExecutionRequest, PipelineStep
from schemas.pipeline_builder_schemas import (
    PipelineExecutionResponse, PipelinePresetListResponse, 
    CreatePipelinePresetRequest, UpdatePipelinePresetRequest
)
from schemas.api_schemas import SaveSummaryResponse
from services.pipeline_core import PipelineOrchestrator
from services.pipeline_nodes import build_node_registry

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core/builder", tags=["Pipeline Builder & Orchestration"])

def get_target_language(
    accept_language: Optional[str] = Header(None),
    x_target_language: Optional[str] = Header(None)
) -> str:
    if x_target_language:
        return x_target_language
    if accept_language:
        primary_lang = accept_language.split(',')[0].split('-')[0].lower()
        if primary_lang == 'ja': return "Japanese"
        elif primary_lang == 'ko': return "Korean"
        elif primary_lang == 'en': return "English"
    return "Korean"

@router.post("/execute", response_model=PipelineExecutionResponse)
async def execute_dynamic_pipeline(
    request: PipelineExecutionRequest, 
    db: Session = Depends(get_db),
    target_lang: str = Depends(get_target_language)
):
    try:
        if "target_lang" not in request.initial_context:
            request.initial_context["target_lang"] = target_lang

        orchestrator = PipelineOrchestrator(db)
        registry = build_node_registry()
        for name, node in registry.items():
            orchestrator.register_node(name, node)

        if request.pipeline_id:
            preset = db.query(MstPipeline).filter(MstPipeline.pipeline_id == request.pipeline_id).first()
            
            # 💡 [자가 치유 로직] 기존 DB에 저장된 프리셋이 구버전(오늘 일지 누락)인 경우 삭제하고 재생성을 유도합니다.
            if preset and request.pipeline_id == "default_synthesis_v1":
                import json
                config_str = json.dumps(preset.config_json)
                if "today_formatted_text" not in config_str:
                    db.delete(preset)
                    db.flush()
                    preset = None
            
            if not preset:
                if request.pipeline_id == "default_synthesis_v1":
                    default_steps = [
                        {
                            "step_id": "node_ltm_search_01",
                            "step_order": 1,
                            "module_name": "LTM_Search",
                            "params": {
                                "query_text": "{{initial_context.query_text}}",
                                "reference_date": "{{initial_context.reference_date}}",
                                "top_k": 3
                            },
                            "output_key": "ltm_search_result"
                        },
                        {
                            "step_id": "node_fetch_ext_02",
                            "step_order": 2,
                            "module_name": "Fetch_Ext_Data",
                            "params": {},
                            "output_key": "ext_data_result"
                        },
                        {
                            "step_id": "node_pre_fact_check_03",
                            "step_order": 3,
                            "module_name": "Pre_Fact_Check",
                            "params": {
                                # 💡 오늘 일자 데이터를 추가로 주입
                                "ltm_context_text": "【오늘의 일지(Today)】\n{{ltm_search_result.today_formatted_text}}\n\n【과거 비정형 기억(LTM)】\n{{ltm_search_result.formatted_text}}",
                                "ext_data_text": "{{ext_data_result}}",
                                "use_pre_fact_check": "{{initial_context.use_pre_fact_check}}"
                            },
                            "output_key": "fact_check_result"
                        },
                        {
                            "step_id": "node_llm_generate_04",
                            "step_order": 4,
                            "module_name": "LLM_Generate",
                            "params": {
                                "pipeline_step": "B_SYNTHESIS",
                                "schema_name": "ContextSynthesisSchema",
                                # 💡 오늘 일자 데이터를 추가로 주입
                                "raw_content": "【오늘의 일지(Today)】\n{{ltm_search_result.today_formatted_text}}\n\n【과거 비정형 기억(LTM)】\n{{ltm_search_result.formatted_text}}\n\n【외부 정형 데이터(EXT)】\n{{ext_data_result}}"
                            },
                            "output_key": "synthesis_result"
                        },
                        {
                            "step_id": "node_persist_db_05",
                            "step_order": 5,
                            "module_name": "Persist_DB",
                            "params": {
                                "target_table": "event_logs",
                                "reference_date": "{{initial_context.reference_date}}",
                                "data": "{{synthesis_result}}"
                            },
                            "output_key": "db_save_result"
                        }
                    ]
                    new_preset = MstPipeline(
                        pipeline_id="default_synthesis_v1",
                        pipeline_name="기본 단기 일지 합성 (Auto-Seeded)",
                        description="시스템 기본 제공 파이프라인 (Sprint 4)",
                        config_json=default_steps,
                        is_active=True
                    )
                    db.add(new_preset)
                    db.flush()
                    request.steps = [PipelineStep(**step) for step in default_steps]
                else:
                    raise HTTPException(status_code=404, detail="요청한 Pipeline Preset을 찾을 수 없습니다.")
            else:
                if not preset.is_active:
                    raise HTTPException(status_code=400, detail="해당 Pipeline Preset은 비활성화 상태입니다.")
                request.steps = [PipelineStep(**step) for step in preset.config_json]

        result = await orchestrator.execute(request)
        db.commit()
        return PipelineExecutionResponse(status="success", final_state=result["final_state"])

    except ValueError as ve:
        db.rollback()
        err_msg = str(ve)
        if err_msg.startswith("FACT_CONFLICT::"):
            import json
            conflict_data = json.loads(err_msg.split("FACT_CONFLICT::")[1])
            raise HTTPException(status_code=409, detail={"type": "FACT_CONFLICT", "discrepancies": conflict_data})
        logger.error(f"파이프라인 실행 검증 오류: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        logger.error(f"파이프라인 실행 치명적 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/presets", response_model=PipelinePresetListResponse)
def get_pipeline_presets(page: int = Query(1), limit: int = Query(20), is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(MstPipeline)
    if is_active is not None:
        query = query.filter(MstPipeline.is_active == is_active)
        
    total_count = query.count()
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    offset = (page - 1) * limit
    
    presets = query.order_by(MstPipeline.up_ts.desc()).offset(offset).limit(limit).all()
    
    data = []
    for p in presets:
        data.append({
            "pipeline_id": p.pipeline_id,
            "pipeline_name": p.pipeline_name,
            "description": p.description,
            "config_json": p.config_json,
            "is_active": p.is_active,
            "up_ts": p.up_ts,
            "ne_ts": p.ne_ts
        })
        
    return {
        "status": "success",
        "data": data,
        "meta": {"total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit}
    }

@router.post("/presets", response_model=SaveSummaryResponse)
def create_pipeline_preset(request: CreatePipelinePresetRequest, db: Session = Depends(get_db)):
    try:
        existing = db.query(MstPipeline).filter(MstPipeline.pipeline_id == request.pipeline_id).first()
        if existing: raise ValueError(f"Pipeline ID '{request.pipeline_id}'는 이미 존재합니다.")
        steps_dict = [step.model_dump() for step in request.config_json]
        new_preset = MstPipeline(pipeline_id=request.pipeline_id, pipeline_name=request.pipeline_name, description=request.description, config_json=steps_dict, is_active=request.is_active)
        db.add(new_preset)
        db.commit()
        return {"status": "success", "message": "새로운 파이프라인 설계도가 성공적으로 저장되었습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/presets/{pipeline_id}", response_model=SaveSummaryResponse)
def update_pipeline_preset(pipeline_id: str, request: UpdatePipelinePresetRequest, db: Session = Depends(get_db)):
    try:
        preset = db.query(MstPipeline).filter(MstPipeline.pipeline_id == pipeline_id).first()
        if not preset: raise ValueError("설계도를 찾을 수 없습니다.")
        steps_dict = [step.model_dump() for step in request.config_json]
        preset.pipeline_name = request.pipeline_name
        preset.description = request.description
        preset.config_json = steps_dict
        preset.is_active = request.is_active
        preset.up_ts = datetime.utcnow()
        db.commit()
        return {"status": "success", "message": "파이프라인 설계도가 성공적으로 수정되었습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/presets/{pipeline_id}", response_model=SaveSummaryResponse)
def delete_pipeline_preset(pipeline_id: str, db: Session = Depends(get_db)):
    try:
        preset = db.query(MstPipeline).filter(MstPipeline.pipeline_id == pipeline_id).first()
        if not preset: raise ValueError("설계도를 찾을 수 없습니다.")
        db.delete(preset)
        db.commit()
        return {"status": "success", "message": "파이프라인 설계도가 영구 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))