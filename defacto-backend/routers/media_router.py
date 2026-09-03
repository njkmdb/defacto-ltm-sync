import os
import shutil
import uuid
import logging
from typing import Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Header
from sqlalchemy.orm import Session

from google import genai  
import PIL.Image

from database.database import get_db, SessionLocal
from database.models import EventRawSource, EventRaw
from schemas.api_schemas import StructureEventsRequest
from services import pipeline_service

from services.system_service import get_dynamic_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/media", tags=["Media Pipeline"])

UPLOAD_BASE_DIR = os.getenv("UPLOAD_DIR", "./uploads_nvme")

# 💡 모듈 레벨 캐싱 변수: 네트워크 지연 방지용
_cached_media_model = None

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

async def extract_text_from_media(file_path: str, source_type: str) -> str:
    global _cached_media_model
    logger.info(f"🚀 Gemini 멀티모달 텍스트 추출 엔진 가동 중... (Type: {source_type}, File: {file_path})")
    
    settings = get_dynamic_settings()
    api_key = settings.get("GEMINI_API_KEY")
    model_name = settings.get("MODEL_NAME", "auto")
    
    if not api_key:
        raise ValueError("GEMINI_API_KEY가 설정되지 않아 AI 추출을 수행할 수 없습니다.")
        
    gemini_client = genai.Client(api_key=api_key)
    
    # 💡 [하드코딩 멸종] "auto"일 경우 방어적 동적 탐색 로직 (generateContent 지원 모델 필터링)
    if model_name == "auto" or not model_name:
        if not _cached_media_model:
            try:
                valid_models = []
                for m in gemini_client.models.list():
                    methods = getattr(m, 'supported_generation_methods', [])
                    # 멀티모달 텍스트 추출을 위해 generateContent 메서드를 지원하는 flash 모델만 필터링
                    if 'generateContent' in methods and 'flash' in m.name.lower() and 'vision' not in m.name.lower():
                        valid_models.append(m.name)
                
                if valid_models:
                    # 버전명 기준 내림차순 정렬하여 최상위 최신 모델 추출
                    _cached_media_model = sorted(valid_models, reverse=True)[0]
                else:
                    _cached_media_model = "gemini-3.5-flash"
            except Exception as e:
                logger.warning(f"멀티모달 모델 동적 탐색 실패, 기본 모델로 폴백합니다: {e}")
                _cached_media_model = "gemini-3.5-flash"
        
        model_name = _cached_media_model
    
    try:
        if source_type == "AUDIO":
            uploaded_audio = await gemini_client.aio.files.upload(file=file_path)
            prompt = (
                "당신은 최고 수준의 음성 인식(STT) AI입니다. "
                "제공된 음성 파일에서 들리는 모든 대화를 정확하게 텍스트로 추출해서 그대로 출력하세요. "
                "인사말이나 요약 등 다른 설명은 일절 덧붙이지 말고 오직 추출된 텍스트만 반환하세요."
            )
            response = await gemini_client.aio.models.generate_content(
                model=model_name,
                contents=[prompt, uploaded_audio]
            )
            await gemini_client.aio.files.delete(name=uploaded_audio.name)
            return response.text.strip()
            
        elif source_type == "IMAGE":
            img = PIL.Image.open(file_path)
            prompt = (
                "당신은 최고 수준의 광학 문자 인식(OCR) AI입니다. "
                "제공된 이미지에 적힌 모든 텍스트를 정확하게 추출해서 그대로 출력하세요. "
                "인사말이나 요약 등 다른 설명은 일절 덧붙이지 말고 오직 추출된 텍스트만 반환하세요."
            )
            response = await gemini_client.aio.models.generate_content(
                model=model_name,
                contents=[prompt, img]
            )
            return response.text.strip()
            
        elif source_type == "DOCUMENT":
            uploaded_pdf = await gemini_client.aio.files.upload(file=file_path)
            prompt = (
                "당신은 최고 수준의 문서 분석 AI입니다. "
                "제공된 PDF 문서에 포함된 모든 텍스트 내용을 정확하게 추출해서 그대로 출력하세요. "
                "인사말이나 요약 등 다른 설명은 일절 덧붙이지 말고 오직 추출된 텍스트만 반환하세요."
            )
            response = await gemini_client.aio.models.generate_content(
                model=model_name,
                contents=[prompt, uploaded_pdf]
            )
            await gemini_client.aio.files.delete(name=uploaded_pdf.name)
            return response.text.strip()
            
        else:
            return "알 수 없는 미디어 형식입니다."
            
    except Exception as e:
        logger.error(f"Gemini 추출 엔진 오류 발생: {str(e)}")
        raise e

async def process_media_background(source_id: int, file_path: str, source_type: str, base_entity_id: int, target_lang: str):
    db: Session = SessionLocal()
    try:
        logger.info(f"[Worker] 미디어 처리 시작 - Source ID: {source_id}, Type: {source_type}")
        
        if source_type == "TEXT":
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    extracted_text = f.read()
            except UnicodeDecodeError:
                logger.info("[Worker] UTF-8 디코딩 실패. CP949로 Fallback 시도합니다.")
                with open(file_path, "r", encoding="cp949") as f:
                    extracted_text = f.read()
        else:
            extracted_text = await extract_text_from_media(file_path, source_type)
        
        new_raw = EventRaw(
            source_id=source_id,
            base_entity_id=base_entity_id,
            event_date=date.today(),
            raw_content=extracted_text,
            sync_status_id=0 
        )
        db.add(new_raw)
        db.flush() 
        
        source_record = db.query(EventRawSource).filter(EventRawSource.source_id == source_id).first()
        if source_record:
            source_record.status_id = 1 
            
        db.commit()
        
        logger.info(f"[Worker] 텍스트 추출 완료. EventRaw(ID: {new_raw.raw_id}) 적재 성공.")
        logger.info(f"[Worker] Process A 파이프라인 연쇄 가동을 시작합니다.")
        
        request = StructureEventsRequest(
            base_entity_id=base_entity_id,
            target_raw_ids=[new_raw.raw_id],
            schema_name="HierarchicalFactSchema",
            retry_failed=False
        )
        await pipeline_service.process_structure_events(request, db, target_lang)
        
        logger.info(f"[Worker] 🟢 파일 업로드 ➡️ 텍스트 추출 ➡️ 팩트 구조화 전체 연쇄 처리 완료!")
        
    except Exception as e:
        db.rollback()
        logger.error(f"[Worker] 🔴 미디어 처리 중 오류 발생 - Source ID: {source_id} | Error: {str(e)}")
        source_record = db.query(EventRawSource).filter(EventRawSource.source_id == source_id).first()
        if source_record:
            source_record.status_id = 2 
            db.commit()
    finally:
        db.close() 

@router.post("/upload")
async def upload_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    base_entity_id: int = Form(...),
    db: Session = Depends(get_db),
    target_lang: str = Depends(get_target_language)
):
    try:
        content_type = file.content_type or ""
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if content_type.startswith("audio/") or file_ext in [".m4a", ".mp3", ".wav"]:
            source_type = "AUDIO"
        elif content_type.startswith("image/") or file_ext in [".jpg", ".png", ".jpeg"]:
            source_type = "IMAGE"
        elif content_type == "application/pdf" or file_ext == ".pdf":
            source_type = "DOCUMENT"
        elif content_type.startswith("text/") or file_ext in [".txt", ".md", ".csv"]:
            source_type = "TEXT"
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")

        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        
        if source_type == "DOCUMENT" and file_size > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="PDF 문서는 10MB를 초과할 수 없습니다.")
        elif source_type == "TEXT" and file_size > 1 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="순수 텍스트 파일(.txt, .md, .csv)은 품질 보장을 위해 1MB를 초과할 수 없습니다.")

        today = datetime.now()
        date_path = today.strftime("%Y/%m/%d")
        save_dir = os.path.join(UPLOAD_BASE_DIR, source_type.lower(), date_path)
        os.makedirs(save_dir, exist_ok=True)

        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(save_dir, unique_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        new_source = EventRawSource(
            source_type=source_type,
            file_url=file_path,
            status_id=0 
        )
        db.add(new_source)
        db.commit()
        db.refresh(new_source)

        background_tasks.add_task(
            process_media_background,
            source_id=new_source.source_id,
            file_path=file_path,
            source_type=source_type,
            base_entity_id=base_entity_id,
            target_lang=target_lang
        )

        return {
            "status": "success",
            "message": "파일이 성공적으로 적재되어 텍스트 추출 및 구조화가 시작되었습니다.",
            "source_id": new_source.source_id,
            "file_url": file_path
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"다이렉트 파일 업로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"파일 적재 중 서버 오류 발생: {str(e)}")