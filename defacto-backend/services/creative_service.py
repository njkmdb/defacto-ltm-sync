import os
import json
import math
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from database.models import EventLog, EventBriefing, EventCreation
from schemas.creative_schemas import GenerateCreativeRequest, SaveCreativeRequest, CreativeContentSchema, GenerateMetaPromptRequest, MetaPromptSchema
from services.lrse_client import LRSEClient
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

LRSE_URL = os.getenv("LRSE_URL")
SESSION_ID = os.getenv("SESSION_ID")
SESSION_SECRET = os.getenv("SESSION_SECRET")

async def generate_creative_content(request: GenerateCreativeRequest, db: Session, target_lang: str = "Korean") -> dict:
    target_texts = []
    for src in request.sources:
        if src.source_type == "LOG":
            log = db.query(EventLog).filter(EventLog.log_id == src.source_id, EventLog.base_entity_id == request.base_entity_id).first()
            if log: target_texts.append(f"[단기 일지 #{src.source_id}]\n{log.llm_summary}")
        elif src.source_type == "BRIEFING":
            briefing = db.query(EventBriefing).filter(EventBriefing.briefing_id == src.source_id, EventBriefing.base_entity_id == request.base_entity_id).first()
            if briefing:
                findings_str = "\n- ".join(briefing.key_findings) if briefing.key_findings else "없음"
                risks_str = "\n- ".join(briefing.risk_and_warnings) if briefing.risk_and_warnings else "없음"
                actions_str = "\n- ".join(briefing.recommended_actions) if briefing.recommended_actions else "없음"
                target_texts.append(f"[심층 리포트 #{src.source_id}]\n■ 총평\n{briefing.executive_summary}\n\n■ 주요 발견\n- {findings_str}\n\n■ 위험/경고\n- {risks_str}\n\n■ 행동 지침\n- {actions_str}")
        elif src.source_type == "CREATION":
            creation = db.query(EventCreation).filter(EventCreation.creation_id == src.source_id, EventCreation.base_entity_id == request.base_entity_id).first()
            if creation: target_texts.append(f"[2차 창작물 #{src.source_id}]\n■ 원본 창작물 제목: {creation.creative_title}\n\n■ 창작물 내용:\n{creation.creative_content}")
    if not target_texts: raise Exception("유효한 원본 데이터 소스를 찾을 수 없거나 접근 권한이 없습니다.")

    combined_target_text = "\n\n".join(target_texts)
    final_instruction = request.system_instruction
    if request.max_length and request.max_length > 0:
        final_instruction += f"\n\n[필수 제약사항] 반드시 최종 결과물의 길이는 공백을 포함하여 {request.max_length}자 내외로 작성하십시오."
        
    final_instruction += f"\n\n[글로벌 언어 제약사항] 모든 최종 출력물은 유창한 {target_lang} 언어로 작성하십시오."

    # 💡 강제 주입 해제
    lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET)
    result = await lrse_client.extract_fact(
        raw_content=f"【원본 팩트 데이터】\n{combined_target_text}", target_schema_cls=CreativeContentSchema, system_instruction=final_instruction, temperature=request.temperature, max_tokens=request.max_length
    )
    if not result.fact_preservation_check: raise Exception("AI 자체 검증 결과, 원본 팩트가 훼손되거나 왜곡될 우려가 있어 창작이 거부되었습니다.")
    return {"status": "success", "data": result.model_dump()}

def save_creative_content(request: SaveCreativeRequest, db: Session) -> dict:
    try:
        source_log_ids, source_briefing_ids, source_creation_ids = [], [], []
        for src in request.sources:
            if src.source_type == "LOG": source_log_ids.append(src.source_id)
            elif src.source_type == "BRIEFING": source_briefing_ids.append(src.source_id)
            elif src.source_type == "CREATION": source_creation_ids.append(src.source_id)
        
        new_creation = EventCreation(
            source_log_ids=source_log_ids, source_briefing_ids=source_briefing_ids, source_creation_ids=source_creation_ids,
            base_entity_id=request.base_entity_id, tone_name=request.tone_name, creative_title=request.creative_title, creative_content=request.creative_content
        )
        db.add(new_creation)
        db.commit()
        return {"status": "success", "message": "다중 팩트 기반 창작물이 아카이브에 영구 저장되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"창작물 저장 중 오류 발생: {str(e)}")

def get_event_creations(db: Session, page: int = 1, limit: int = 20, base_entity_id: int = None, start_date: str = None, end_date: str = None, search_conditions: str = None) -> dict:
    query = db.query(EventCreation)
    if base_entity_id: query = query.filter(EventCreation.base_entity_id == base_entity_id)
    if start_date:
        try: query = query.filter(EventCreation.ne_ts >= datetime.strptime(start_date, "%Y-%m-%d"))
        except ValueError: pass
    if end_date:
        try: query = query.filter(EventCreation.ne_ts <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
        except ValueError: pass
    if search_conditions:
        try:
            conds = json.loads(search_conditions)
            if conds and isinstance(conds, list):
                def build_cond(target, kw):
                    kw = kw.strip()
                    if target == 'CREATION_ID' and kw.isdigit(): return EventCreation.creation_id == int(kw)
                    elif target == 'ENTITY_ID' and kw.isdigit(): return EventCreation.base_entity_id == int(kw)
                    elif target == 'TONE_NAME': return EventCreation.tone_name.ilike(f"%{kw}%")
                    elif target == 'TITLE': return EventCreation.creative_title.ilike(f"%{kw}%")
                    elif target == 'CONTENT': return EventCreation.creative_content.ilike(f"%{kw}%")
                    return None
                combined_expr = None
                for c in conds:
                    kw = c.get('keyword', '')
                    if not kw.strip(): continue
                    expr = build_cond(c.get('target'), kw)
                    if expr is not None:
                        if combined_expr is None: combined_expr = expr
                        else:
                            op = c.get('operator', 'AND')
                            if op == 'OR': combined_expr = or_(combined_expr, expr)
                            else: combined_expr = and_(combined_expr, expr)
                if combined_expr is not None: query = query.filter(combined_expr)
        except Exception as e: logger.error(f"다중 검색 파싱 오류: {e}")
    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    rows = query.order_by(EventCreation.creation_id.desc()).offset(offset).limit(limit).all()
    
    data = []
    for r in rows:
        sources = []
        for lid in (r.source_log_ids or []): sources.append({"source_type": "LOG", "source_id": lid})
        for bid in (r.source_briefing_ids or []): sources.append({"source_type": "BRIEFING", "source_id": bid})
        for cid in (r.source_creation_ids or []): sources.append({"source_type": "CREATION", "source_id": cid})
        data.append({"creation_id": r.creation_id, "sources": sources, "base_entity_id": r.base_entity_id, "tone_name": r.tone_name, "creative_title": r.creative_title, "creative_content": r.creative_content, "ne_ts": r.ne_ts})
    return {"status": "success", "data": data, "meta": { "total_count": total, "current_page": page, "total_pages": total_pages, "limit": limit }}

def delete_event_creation(creation_id: int, base_entity_id: int, db: Session) -> dict:
    try:
        creation = db.query(EventCreation).filter(EventCreation.creation_id == creation_id, EventCreation.base_entity_id == base_entity_id).first()
        if not creation: raise Exception("해당 창작물을 찾을 수 없거나 권한이 없습니다.")
        linked_creations = db.query(EventCreation).filter(EventCreation.source_creation_ids.contains([creation_id])).all()
        for c in linked_creations: c.source_creation_ids = [cid for cid in c.source_creation_ids if cid != creation_id]
        db.delete(creation)
        db.commit()
        return {"status": "success", "message": "창작물이 영구 삭제되었습니다."}
    except Exception as e:
        db.rollback()
        raise Exception(f"창작물 삭제 실패: {str(e)}")

async def generate_creative_meta_prompt(request: GenerateMetaPromptRequest, target_lang: str = "Korean") -> dict:
    meta_instruction = (
        f"당신은 최고 수준의 AI 프롬프트 엔지니어입니다. 사용자가 요구하는 [톤앤매너/스타일]을 바탕으로, 다른 LLM이 2차 창작을 수행할 때 사용할 '시스템 프롬프트'를 작성하십시오.\n"
        f"작성할 프롬프트에는 반드시 다음 제약사항이 포함되어야 합니다:\n"
        f"1. 원본 팩트를 100% 보존하고 절대 지어내지 말 것.\n"
        f"2. fact_preservation_check 검증 로직을 반드시 지시할 것.\n"
        f"3. 생성되는 프롬프트 문장 전체를 반드시 {target_lang} 언어로 작성할 것."
    )
    # 💡 강제 주입 해제
    lrse_client = LRSEClient(lrse_url=LRSE_URL, session_id=SESSION_ID, session_secret=SESSION_SECRET)
    result = await lrse_client.extract_fact(raw_content=f"[사용자 요구 톤앤매너]: {request.user_intent}", target_schema_cls=MetaPromptSchema, system_instruction=meta_instruction, temperature=0.7)
    return {"status": "success", "data": {"suggested_prompt": result.generated_prompt}}

def get_event_creation(creation_id: int, base_entity_id: int, db: Session) -> dict:
    r = db.query(EventCreation).filter(EventCreation.creation_id == creation_id, EventCreation.base_entity_id == base_entity_id).first()
    if not r: raise Exception("해당 창작물을 찾을 수 없거나 접근 권한이 없습니다.")
    sources = []
    for lid in (r.source_log_ids or []): sources.append({"source_type": "LOG", "source_id": lid})
    for bid in (r.source_briefing_ids or []): sources.append({"source_type": "BRIEFING", "source_id": bid})
    for cid in (r.source_creation_ids or []): sources.append({"source_type": "CREATION", "source_id": cid})
    return {"status": "success", "data": {"creation_id": r.creation_id, "sources": sources, "base_entity_id": r.base_entity_id, "tone_name": r.tone_name, "creative_title": r.creative_title, "creative_content": r.creative_content, "ne_ts": r.ne_ts}}