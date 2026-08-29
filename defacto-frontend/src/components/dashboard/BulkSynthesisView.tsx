'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Calendar, RefreshCw, Layers, CheckCircle, XCircle } from 'lucide-react';
import { triggerBulkSynthesize, getBatchJobStatus, getPipelinePresets } from '@/lib/api/pipeline';
import { BatchJobStatusResponse } from '@/types/api';

export default function BulkSynthesisView() {
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('default_synthesis_v1');
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);

  const { data: presets } = useQuery({
    queryKey: ['pipelinePresets'],
    queryFn: () => getPipelinePresets(1, 50, true)
  });

  const bulkMut = useMutation({
    mutationFn: async () => {
      if (!selectedPipelineId) throw new Error("파이프라인 프리셋을 선택해주세요.");
      return await triggerBulkSynthesize(bulkDate, selectedPipelineId);
    },
    onSuccess: (data) => {
      setBulkJobId(data.job_id);
    },
    onError: (err: any) => alert(err.response?.data?.detail || err.message || "일괄 합성에 실패했습니다.")
  });

  const { data: jobStatus } = useQuery<BatchJobStatusResponse>({
    queryKey: ['batchJob', bulkJobId],
    queryFn: () => getBatchJobStatus(bulkJobId!),
    enabled: !!bulkJobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return bulkJobId ? 3000 : false;
      return (data.status === 'RUNNING' || data.status === 'PENDING') ? 3000 : false;
    }
  });

  const progress = jobStatus && jobStatus.total_count > 0 ? Math.round((jobStatus.current_count / jobStatus.total_count) * 100) : 0;
  const isJobActive = jobStatus?.status === 'RUNNING' || jobStatus?.status === 'PENDING';

  return (
    <div className="flex-1 flex flex-col h-full">
      <p className="text-sm text-gray-600 mb-6 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 leading-relaxed shrink-0">
         특정 일자에 접수된 모든 비정형 데이터를 조회하여, 각 주체(Entity)별로 백그라운드에서 동적 파이프라인을 일괄 가동합니다. TPM(토큰 제한) 방어를 위해 최대 3개의 워커가 병렬로 분산 처리합니다.
      </p>

      <div className="flex gap-4 mb-4 shrink-0">
        <div className="flex-1">
           <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4" /> Target Date (대상 일자)</label>
           <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-gray-700" />
        </div>
      </div>

      <div className="mb-6 shrink-0">
        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> Pipeline Preset</label>
        <select value={selectedPipelineId} onChange={e => setSelectedPipelineId(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white shadow-sm font-bold text-gray-800">
          <option value="">(필수) 일괄 가동할 파이프라인을 선택하세요...</option>
          <option value="default_synthesis_v1">시스템 기본 파이프라인</option>
          {presets?.data?.filter((p: any) => p.pipeline_id !== 'default_synthesis_v1').map((p: any) => (
            <option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}</option>
          ))}
        </select>
      </div>

      <button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending || isJobActive || !selectedPipelineId} className={`w-full mb-8 flex items-center justify-center gap-2 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 shadow-md shrink-0 ${selectedPipelineId ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-900 hover:bg-black'}`}>
         {bulkMut.isPending || isJobActive ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />} 동적 파이프라인 일괄 백그라운드 가동
      </button>

      {bulkJobId && (
         <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center justify-between">
               <span>진행 상태 관제 (Job ID: <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ml-1">{bulkJobId.split('-')[0]}</span>)</span>
               {jobStatus?.status === 'RUNNING' || jobStatus?.status === 'PENDING' ? (
                  <span className="flex items-center gap-1.5 text-blue-600 text-xs bg-blue-50 px-2 py-1 rounded-full border border-blue-100"><RefreshCw className="w-3.5 h-3.5 animate-spin"/> {jobStatus?.status}</span>
               ) : jobStatus?.status === 'COMPLETED' ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 text-xs bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100"><CheckCircle className="w-3.5 h-3.5"/> COMPLETED</span>
               ) : (
                  <span className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 px-2 py-1 rounded-full border border-red-100"><XCircle className="w-3.5 h-3.5"/> FAILED</span>
               )}
            </h3>

            <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden shadow-inner relative">
               <div className={`h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 text-[10px] font-extrabold text-white ${jobStatus?.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }}>
                  {progress > 5 ? `${progress}%` : ''}
               </div>
            </div>

            <div className="flex justify-between text-xs font-bold text-gray-500 px-1">
               <span>{progress}% 완료됨</span>
               <span><strong className="text-indigo-600 text-sm">{jobStatus?.current_count || 0}</strong> / {jobStatus?.total_count || 0} 개 주체 처리</span>
            </div>

            {jobStatus?.error_log && (
               <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {jobStatus.error_log}
               </div>
            )}
         </div>
      )}
    </div>
  );
}