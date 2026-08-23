'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, RefreshCw } from 'lucide-react';
import { createRawEvent } from '@/lib/api/pipeline';

interface CreateRawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateRawModal({ isOpen, onClose, onSuccess }: CreateRawModalProps) {
  const [createData, setCreateData] = useState({ 
    entityId: 1024, 
    date: new Date().toISOString().split('T')[0], 
    content: '', 
    runNow: true 
  });

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
      alert(error.response?.data?.detail || "데이터 저장에 실패했습니다. (Entity ID가 존재하는지 확인해주세요)");
    }
  });

  const handleCreateSubmit = () => {
    if (!createData.content.trim()) return alert("텍스트를 입력해주세요.");
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
      <div className="bg-white p-8 rounded-2xl w-[900px] max-w-[95vw] shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">신규 비정형 텍스트 수동 적재</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Base Entity ID</label>
              <input 
                type="number" 
                value={createData.entityId} 
                onChange={e => setCreateData({...createData, entityId: parseInt(e.target.value)})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" 
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Event Date</label>
              <input 
                type="date" 
                value={createData.date} 
                onChange={e => setCreateData({...createData, date: e.target.value})} 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base" 
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Raw Content (비정형 텍스트)</label>
            <textarea 
              value={createData.content} 
              onChange={e => setCreateData({...createData, content: e.target.value})} 
              placeholder="예: 오늘 알파팀과 미팅을 진행했고, 계약 금액은 500만원으로 확정되었다."
              className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base resize-none leading-relaxed" 
            />
          </div>

          <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <input 
              type="checkbox" 
              id="runNowCreate" 
              checked={createData.runNow} 
              onChange={e => setCreateData({...createData, runNow: e.target.checked})} 
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="runNowCreate" className="text-base font-semibold text-blue-800 cursor-pointer">
              저장 직후 파이프라인 즉시 가동
            </label>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-200 transition-colors">
            취소
          </button>
          <button 
            onClick={handleCreateSubmit} 
            disabled={createMutation.isPending} 
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-base font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {createMutation.isPending && <RefreshCw className="w-5 h-5 animate-spin" />} 저장
          </button>
        </div>
      </div>
    </div>
  );
}