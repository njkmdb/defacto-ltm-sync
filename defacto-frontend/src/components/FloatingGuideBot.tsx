'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { sendChatMessage } from '@/lib/api/pipeline';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

export default function FloatingGuideBot() {
  const router = useRouter();
  const locale = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Drag and Drop State ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      setPosition({
        x: dragStart.current.posX + deltaX,
        y: dragStart.current.posY + deltaY
      });
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // 닫기 버튼 클릭 시 드래그 이벤트가 겹치지 않도록 방지
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };
  // ---------------------------

  // 세션 및 대화 내역 초기화/복구 로직
  useEffect(() => {
    const sessionKey = `guide_bot_session_id_${locale}`; // 언어별 세션 키 분리
    const chatHistoryKey = `guide_bot_messages_${locale}`; // 대화 내역 저장 키

    let sid = sessionStorage.getItem(sessionKey);

    // 세션이 존재하지 않을 때만 발급하여 렌더링/새로고침 시 대화 증발 방지
    if (!sid) {
      sid = `guide_session_${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem(sessionKey, sid);
    }
    setSessionId(sid);

    let greeting = "안녕하세요! Defacto 가이드 봇입니다. 무엇을 도와드릴까요?";
    if (locale === 'en') greeting = "Hello! I am the Defacto guide bot. How can I help you?";
    if (locale === 'ja') greeting = "こんにちは！Defactoガイドボットです。何かお手伝いしましょうか？";

    // 세션 로드 시 대화 내역도 함께 복구
    const savedMessages = sessionStorage.getItem(chatHistoryKey);

    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (e) {
        console.error("Failed to parse saved chat messages", e);
        setMessages([{ id: 'init-msg', sender: 'bot', text: greeting }]);
      }
    } else {
      setMessages([
        { id: 'init-msg', sender: 'bot', text: greeting }
      ]);
    }
  }, [locale]);

  // 메시지가 업데이트 될 때마다 sessionStorage 갱신
  useEffect(() => {
    if (messages.length > 0) {
      const chatHistoryKey = `guide_bot_messages_${locale}`;
      sessionStorage.setItem(chatHistoryKey, JSON.stringify(messages));
    }
  }, [messages, locale]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!inputText.trim() || !sessionId || isLoading) return;
    
    const userMsg = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const res = await sendChatMessage({
        session_id: sessionId,
        user_message: userMsg,
        base_entity_id: 1024
      });

      const { answer, action_code, target_menu } = res.data;

      setMessages(prev => [...prev, { id: Date.now().toString() + 'b', sender: 'bot', text: answer }]);

      if (action_code === 'NAVIGATE' && target_menu && target_menu !== 'NONE') {
        const targetPath = target_menu === 'DASHBOARD' 
          ? `/${locale}` 
          : `/${locale}/${target_menu.toLowerCase()}`;
        
        router.push(targetPath);
      }
      
    } catch (error) {
      console.error("Chat API Error:", error);
      let errorMsg = "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
      if (locale === 'en') errorMsg = "A system error occurred. Please try again later.";
      if (locale === 'ja') errorMsg = "システムエラーが発生しました。後でもう一度お試しください。";
      setMessages(prev => [...prev, { id: Date.now().toString() + 'e', sender: 'bot', text: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed bottom-24 right-8 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-[100]"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px)`,
            width: '384px', 
            height: '550px',
            minWidth: '300px',
            minHeight: '400px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            resize: 'both', // 모서리를 통한 리사이징(크기 조절) 기능 활성화
            overflow: 'hidden'
          }}
        >
          <div 
            className="p-4 bg-indigo-600 text-white flex items-center justify-between shrink-0 cursor-move select-none"
            onMouseDown={handleMouseDown}
          >
             <div className="flex items-center gap-2.5 pointer-events-none">
               <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                 <Bot className="w-5 h-5 text-white" />
               </div>
               <div>
                 <span className="font-bold block text-sm leading-none mb-1">Defacto Guide Bot</span>
                 <span className="text-[10px] font-medium text-indigo-200">Defacto LTM-Sync</span>
               </div>
             </div>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setIsOpen(false);
               }} 
               className="hover:bg-indigo-700 p-1.5 rounded-lg transition-colors cursor-pointer"
             >
               <X className="w-5 h-5" />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-4">
             {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 max-w-[85%] ${msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-blue-100 text-blue-600 shadow-sm' : 'bg-indigo-100 text-indigo-600 shadow-sm'}`}>
                    {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`p-3.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap font-medium ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm shadow-md' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'}`}>
                    {msg.text}
                  </div>
                </div>
             ))}
             
             {isLoading && (
                <div className="flex gap-2.5 max-w-[85%] self-start animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-gray-200 rounded-tl-sm shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Thinking...</span>
                  </div>
                </div>
             )}
             <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100 shrink-0 flex items-center gap-2">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="flex-1 bg-gray-100 border border-transparent focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 rounded-xl px-4 py-3 text-sm outline-none transition-all disabled:opacity-50 text-gray-700 font-medium"
            />
            <button 
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center z-[100] transition-transform hover:scale-105 active:scale-95 border-2 border-white"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </>
  );
}