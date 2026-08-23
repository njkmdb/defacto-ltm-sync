import math
from datetime import datetime
from sqlalchemy.orm import Session
from database.models import MstPrompt
from schemas.api_schemas import CreatePromptRequest, UpdatePromptRequest

def get_prompts(db: Session, page: int = 1, limit: int = 20, target_type: str = None, pipeline_step: str = None):
    query = db.query(MstPrompt)
    if target_type and target_type != 'ALL':
        query = query.filter(MstPrompt.target_type == target_type)
    if pipeline_step and pipeline_step != 'ALL':
        query = query.filter(MstPrompt.pipeline_step == pipeline_step)
        
    total_count = query.count()
    total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
    offset = (page - 1) * limit
    
    prompts = query.order_by(MstPrompt.up_ts.desc()).offset(offset).limit(limit).all()
    
    data = []
    for p in prompts:
        data.append({
            "prompt_id": p.prompt_id,
            "target_type": p.target_type,
            "target_value": p.target_value,
            "pipeline_step": p.pipeline_step,
            "schema_name": p.schema_name,
            "system_prompt": p.system_prompt,
            "temperature": float(p.temperature) if p.temperature is not None else 0.7,
            "max_length": int(p.max_length) if p.max_length is not None else 1000, # 💡 글자수 바인딩
            "is_active": p.is_active,
            "up_ts": p.up_ts,
            "ne_ts": p.ne_ts
        })
        
    return {
        "status": "success",
        "data": data,
        "meta": {"total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit}
    }

def create_prompt(request: CreatePromptRequest, db: Session):
    new_prompt = MstPrompt(
        target_type=request.target_type,
        target_value=request.target_value,
        pipeline_step=request.pipeline_step,
        schema_name=request.schema_name,
        system_prompt=request.system_prompt,
        temperature=request.temperature,
        max_length=request.max_length, # 💡
        is_active=request.is_active
    )
    db.add(new_prompt)
    db.commit()
    return {"status": "success", "message": "새로운 프롬프트가 성공적으로 생성되었습니다."}

def update_prompt(prompt_id: int, request: UpdatePromptRequest, db: Session):
    prompt = db.query(MstPrompt).filter(MstPrompt.prompt_id == prompt_id).first()
    if not prompt:
        raise Exception("프롬프트를 찾을 수 없습니다.")
        
    prompt.target_type = request.target_type
    prompt.target_value = request.target_value
    prompt.pipeline_step = request.pipeline_step
    prompt.schema_name = request.schema_name
    prompt.system_prompt = request.system_prompt
    prompt.temperature = request.temperature
    prompt.max_length = request.max_length # 💡
    prompt.is_active = request.is_active
    prompt.up_ts = datetime.utcnow()
    
    db.commit()
    return {"status": "success", "message": "프롬프트가 성공적으로 수정되었습니다."}

def delete_prompt(prompt_id: int, db: Session):
    prompt = db.query(MstPrompt).filter(MstPrompt.prompt_id == prompt_id).first()
    if not prompt:
        raise Exception("프롬프트를 찾을 수 없습니다.")
    db.delete(prompt)
    db.commit()
    return {"status": "success", "message": "프롬프트가 영구 삭제되었습니다."}