'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X, RefreshCw } from 'lucide-react';
import { createRawEvent } from '@/lib/api/pipeline';

interface CreateRawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRawModal({ isOpen, onClose, onSuccess }: CreateRawModalProps) {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');

  const [createData, setCreateData] = useState({ 
    entityId: 1024, 
    date: new Date().toISOString().split('T')[0], 
    content: '', 
    runNow: true 
  });

  // --- Drag and Drop State ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (!isOpen) setPosition({ x: 0, y: 0 }); // 닫힐 때 위치 초기화
  }, [isOpen]);

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
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  };
  // ---------------------------

  const createMutation = useMutation({
    mutationFn: createRawEvent,
    onSuccess: (data) => {
      alert(data.message);
      setCreateData(prev => ({ ...prev, content: '' }));
      onSuccess(); 
      onClose();
    },
    onError: (error: any) => {
      console.error("Create API Error:", error);
      alert(error.response?.data?.detail || t('alert_create_fail'));
    }
  });

  const handleCreateSubmit = () => {
    if (!createData.content.trim()) return alert(t('alert_req_text'));
    createMutation.mutate({
      base_entity_id: createData.entityId,
      event_date: createData.date,
      raw_content: createData.content,
      run_pipeline_now: createData.runNow,
      schema_name: 'HierarchicalFactSchema'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-2xl flex flex-col shadow-2xl border border-gray-100 relative"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: '900px',
          minWidth: '500px',
          minHeight: '400px',
          maxHeight: '90vh',
          resize: 'both',
          overflow: 'hidden'
        }}
      >
        <div 
          className="px-8 py-6 flex items-center justify-between border-b border-gray-100 shrink-0 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-xl font-bold text-gray-800 pointer-events-none">{t('modal_create_title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_base_entity')}</label>
              <input 
                type="number" 
                value={createData.entityId} 
                onChange={e => setCreateData({...createData, entityId: parseInt(e.target.value)})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" 
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_event_date')}</label>
              <input 
                type="date" 
                value={createData.date} 
                onChange={e => setCreateData({...createData, date: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" 
              />
            </div>
          </div>
          
          <div className="flex flex-col h-[calc(100%-140px)] min-h-[250px]">
            <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_raw_content')}</label>
            <textarea 
              value={createData.content} 
              onChange={e => setCreateData({...createData, content: e.target.value})} 
              placeholder={t('modal_create_placeholder')}
              className="w-full flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base resize-none leading-relaxed" 
            />
          </div>

          <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100 shrink-0">
            <input 
              type="checkbox" 
              id="runNowCreate" 
              checked={createData.runNow} 
              onChange={e => setCreateData({...createData, runNow: e.target.checked})} 
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="runNowCreate" className="text-base font-semibold text-blue-800 cursor-pointer">
              {t('modal_run_now')}
            </label>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-200 transition-colors">
            {tCommon('cancel')}
          </button>
          <button 
            onClick={handleCreateSubmit} 
            disabled={createMutation.isPending} 
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md"
          >
            {createMutation.isPending && <RefreshCw className="w-5 h-5 animate-spin" />} {tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}