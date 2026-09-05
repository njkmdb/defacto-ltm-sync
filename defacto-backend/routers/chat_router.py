import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header
from schemas.chat_schemas import ChatRequest
from services import chat_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/core", tags=["Chatbot Guide"])

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

@router.post("/chat")
async def chat_endpoint(request: ChatRequest, target_lang: str = Depends(get_target_language)):
    return await chat_service.process_chat_message(request, target_lang)