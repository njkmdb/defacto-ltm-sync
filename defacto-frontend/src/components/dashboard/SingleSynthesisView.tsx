'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Calendar, User, Save, ListTodo, CheckCircle, RefreshCw, Flame } from 'lucide-react';
import { triggerSynthesizeContext } from '@/lib/api/pipeline';
import { saveContextSummary } from '@/lib/api/archive';
import { SynthesizeContextResponse } from '@/types/api';

export default function SingleSynthesisView() {
  const [entityId, setEntityId] = useState<number>(1024);
  const [refDate, setRefDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [useDeepSearch, setUseDeepSearch] = useState<boolean>(false);
  const [synthData, setSynthData] = useState<SynthesizeContextResponse | null>(null);
  const [editableSummary, setEditableSummary] = useState<string>('');

  const synthMutation = useMutation({
    mutationFn: async () => await triggerSynthesizeContext(entityId, refDate, useDeepSearch),
    onSuccess: (data) => {
      setSynthData(data);
      setEditableSummary(data.data.synthesized_data.llm_summary);
    },
    onError: () => alert("컨텍스트 합성에 실패했습니다.")
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const actionItemsToSave = synthData?.data.synthesized_data.action_items || [];
      return await saveContextSummary(entityId, refDate, editableSummary, actionItemsToSave);
    },
    onSuccess: (data) => alert(`🎉 [저장 성공] ${data.message}`),
    onError: () => alert("저장에 실패했습니다.")
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end mb-4 -mt-2 shrink-0">
        {synthData && (
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full flex items-center gap-1 uppercase tracking-wider">
            <CheckCircle className="w-3 h-3" /> {synthData.data.rag_metrics.memory_type_used}
          </span>
        )}
      </div>
      <div className="flex gap-4 mb-4 shrink-0">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><User className="w-4 h-4" /> Base Entity ID</label>
          <input type="number" value={entityId} onChange={(e) => setEntityId(parseInt(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4" /> Reference Date</label>
          <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
      </div>

      <div className="flex items-center gap-3 bg-red-50/50 p-4 rounded-xl border border-red-100 mb-6 transition-colors hover:bg-red-50 shrink-0">
        <input
          type="checkbox"
          id="useDeepSearch"
          checked={useDeepSearch}
          onChange={e => setUseDeepSearch(e.target.checked)}
          className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer"
        />
        <label htmlFor="useDeepSearch" className="text-sm font-bold text-red-800 cursor-pointer flex items-center gap-1.5">
          <Flame className="w-4 h-4" /> 심층 추론 모드 (연관 원본 데이터 강제 추출 / 토큰 소모량 증가)
        </label>
      </div>

      <button onClick={() => synthMutation.mutate()} disabled={synthMutation.isPending} className="w-full mb-6 shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-md">
        {synthMutation.isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} AI 일지 생성 (투트랙 LTM 융합)
      </button>

      {synthData ? (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
              <span>최종 요약본 (수동 편집 가능)</span>
              <button onClick={() => { if (!editableSummary.trim()) return alert("내용이 없습니다."); saveMutation.mutate(); }} disabled={saveMutation.isPending} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 border border-indigo-200">
                {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 확정 및 저장
              </button>
            </label>
            <textarea value={editableSummary} onChange={(e) => setEditableSummary(e.target.value)} className="w-full min-h-[250px] p-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-gray-800 bg-indigo-50/30 leading-relaxed resize-none shadow-inner" />
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> 추출된 Action Items
            </label>
            {synthData.data.synthesized_data.action_items.length > 0 ? (
              <ul className="space-y-2 pb-4">
                {synthData.data.synthesized_data.action_items.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded shrink-0">{item.due_date}</span>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{item.task}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 font-bold bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">추출된 Action Item이 없습니다.</p>
            )}
          </div>
        </div>
      ) : (
         <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
            <FileText className="w-16 h-16 mb-4" />
            <p className="font-bold text-lg">AI 일지 생성을 시작해주세요</p>
            <p className="text-sm mt-2">좌측의 파이프라인에서 추출된 팩트들을 모아<br/>LTM 과거 기억과 함께 종합적인 컨텍스트를 생성합니다.</p>
         </div>
      )}
    </div>
  );
}