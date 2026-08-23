'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'; 
import { Play, RefreshCw, CheckCircle, XCircle, Clock, Plus, Trash2, Edit2, Loader2, Filter, ChevronLeft, ChevronRight } from 'lucide-react'; 
import { triggerStructureEvents, getPipelineStatus, deleteRawEvent, deleteBulkRawEvents } from '@/lib/api/pipeline'; 
import CreateRawModal from '@/components/modals/CreateRawModal';
import EditRawModal from '@/components/modals/EditRawModal';

// 💡 [아키텍처 개선] 수백 페이지가 넘어가도 UI가 깨지지 않도록 Windowing 기법 도입
const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function PipelineControlSection() {
  const queryClient = useQueryClient(); 

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(5);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [startDate, endDate, limit, statusFilter]);

  const { data: pipelineStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['pipelineStatus', page, limit, startDate, endDate, statusFilter],
    queryFn: () => getPipelineStatus({ page, limit, startDate, endDate, statusFilter }),
    refetchInterval: 3000 
  });

  const currentMeta = pipelineStatus?.meta;

  const structureMutation = useMutation({
    mutationFn: async ({ ids, retry }: { ids: number[], retry: boolean }) => triggerStructureEvents(ids, 1, 'HierarchicalFactSchema', retry),
    onSuccess: () => { setSelectedIds([]); queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); },
    onError: () => alert("백엔드 통신에 실패했습니다.")
  });

  const deleteMutation = useMutation({
    mutationFn: (rawId: number) => deleteRawEvent(rawId),
    onSuccess: (data) => { alert(data.message); queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); },
    onError: (error: any) => alert(error.response?.data?.detail || "삭제에 실패했습니다.")
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (rawIds: number[]) => deleteBulkRawEvents(rawIds),
    onSuccess: (data) => { alert(data.message); setSelectedIds([]); queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); },
    onError: (error: any) => alert(error.response?.data?.detail || "일괄 삭제에 실패했습니다.")
  });

  const toggleSelectAll = () => {
    if (pipelineStatus?.data_list) {
      if (selectedIds.length === pipelineStatus.data_list.length && pipelineStatus.data_list.length > 0) setSelectedIds([]);
      else setSelectedIds(pipelineStatus.data_list.map((item: any) => item.raw_id));
    }
  };

  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`선택한 ${selectedIds.length}개의 데이터를 정말 삭제하시겠습니까?\n해당 날짜에 연관된 AI 기억도 모두 일괄 초기화됩니다.`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleBulkRetry = () => {
    if (selectedIds.length === 0) return;
    structureMutation.mutate({ ids: selectedIds, retry: true });
  };

  const [isCreateModalOpen, setIsCreateOpen] = useState(false);
  const [isEditModalOpen, setIsEditOpen] = useState(false);
  const [editModalData, setEditModalData] = useState<{ rawId: number; baseEntityId: number; content: string; date: string } | null>(null);

  const openEditModal = (rawId: number, baseEntityId: number, content: string, date: string) => {
    setEditModalData({ rawId, baseEntityId, content, date });
    setIsEditOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-600" /> 실시간 파이프라인 관제
        </h2>
        <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> 수동 텍스트 적재
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div onClick={() => setStatusFilter('ALL')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === 'ALL' ? 'bg-gray-800 border-gray-900 shadow-md' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === 'ALL' ? 'text-gray-300' : 'text-gray-500'}`}>전체 수집</span>
          <span className={`text-xl font-bold ${statusFilter === 'ALL' ? 'text-white' : 'text-gray-800'}`}>{pipelineStatus?.total_count || 0}</span>
        </div>
        <div onClick={() => setStatusFilter('1')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === '1' ? 'bg-green-600 border-green-700 shadow-md' : 'bg-green-50 border-green-100 hover:bg-green-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === '1' ? 'text-green-100' : 'text-green-600'}`}>Synced</span>
          <span className={`text-xl font-bold ${statusFilter === '1' ? 'text-white' : 'text-green-700'}`}>{pipelineStatus?.success_count || 0}</span>
        </div>
        <div onClick={() => setStatusFilter('0')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === '0' ? 'bg-yellow-500 border-yellow-600 shadow-md' : 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === '0' ? 'text-yellow-100' : 'text-yellow-600'}`}>처리대기</span>
          <span className={`text-xl font-bold ${statusFilter === '0' ? 'text-white' : 'text-yellow-700'}`}>{pipelineStatus?.pending_count || 0}</span>
        </div>
        <div onClick={() => setStatusFilter('2')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === '2' ? 'bg-red-600 border-red-700 shadow-md' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === '2' ? 'text-red-100' : 'text-red-600'}`}>Failed</span>
          <span className={`text-xl font-bold ${statusFilter === '2' ? 'text-white' : 'text-red-700'}`}>{pipelineStatus?.failed_count || 0}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 mt-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-600 hover:text-gray-900 border-r border-gray-200 pr-3">
            <input type="checkbox" checked={pipelineStatus?.data_list?.length > 0 && selectedIds.length === pipelineStatus.data_list.length} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"/> 전체 선택
          </label>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs font-semibold text-gray-600 outline-none bg-transparent cursor-pointer w-[100px]" />
            <span className="text-gray-300 font-bold px-0.5">~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs font-semibold text-gray-600 outline-none bg-transparent cursor-pointer w-[100px]" />
            {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-gray-400 hover:text-red-500 ml-1.5 border-l border-gray-200 pl-2"><XCircle className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <button onClick={handleBulkRetry} disabled={structureMutation.isPending} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-bold border border-blue-200 shadow-sm disabled:opacity-50">
                {structureMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} 선택 재시도 ({selectedIds.length})
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending} className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-bold border border-red-200 shadow-sm disabled:opacity-50">
                {bulkDeleteMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} 삭제 ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 border border-gray-200 rounded-xl bg-gray-50 p-2 overflow-hidden">
        {isStatusLoading ? (
          <p className="text-center text-gray-400 mt-10 text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 데이터를 불러오는 중...</p>
        ) : (
          <ul className="space-y-2">
            {pipelineStatus?.data_list.length === 0 ? (
              <p className="text-center text-gray-400 mt-10 text-sm font-bold">조건에 일치하는 데이터가 없습니다.</p>
            ) : pipelineStatus?.data_list.map((item: any) => (
              <li key={item.raw_id} onClick={() => toggleSelect(item.raw_id)} onDoubleClick={() => openEditModal(item.raw_id, item.base_entity_id, item.raw_content, item.event_date)} title="더블클릭하여 데이터 교정" className={`bg-white p-3 rounded-lg border shadow-sm flex flex-col gap-1 transition-all cursor-pointer ${selectedIds.includes(item.raw_id) ? 'border-blue-400 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(item.raw_id)} onChange={() => toggleSelect(item.raw_id)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"/>
                    <span className="text-xs font-bold text-gray-500">ID: {item.raw_id}</span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{item.event_date || '날짜 미상'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.sync_status_id === 1 && <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3"/> Synced</span>}
                    {item.sync_status_id === 2 && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3"/> Failed</span>}
                    {item.sync_status_id === 0 && <span className="flex items-center gap-1 text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3"/> Pending</span>}
                  </div>
                </div>
                <p className={`text-sm ml-6 font-medium ${item.raw_content ? 'text-gray-800' : 'text-gray-400 italic'}`} title={item.raw_content}>{item.raw_content || '미디어 파일에서 텍스트를 추출하고 있습니다...'}</p>
                {item.error_log && <p className="text-[10px] text-red-500 mt-1 ml-6 bg-red-50 p-1 rounded font-bold">오류: {item.error_log}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border border-gray-200 bg-white shadow-sm p-3 rounded-xl">
        <span className="text-xs font-bold text-gray-500 pl-1">총 {currentMeta?.total_count || 0} 건</span>
        <div className="flex items-center gap-1.5">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-3 h-3" /></button>
          <div className="flex gap-1">
            {getPageNumbers(page, currentMeta?.total_pages || 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className={`w-6 h-6 rounded text-xs font-bold ${page === p ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
            ))}
          </div>
          <button disabled={page >= (currentMeta?.total_pages || 1)} onClick={() => setPage(p => p + 1)} className="p-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-3 h-3" /></button>
        </div>
        <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded px-2 py-1 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-gray-600">
          <option value={5}>5개씩 보기</option>
          <option value={10}>10개씩 보기</option>
          <option value={20}>20개씩 보기</option>
          <option value={50}>50개씩 보기</option>
        </select>
      </div>

      <CreateRawModal isOpen={isCreateModalOpen} onClose={() => setIsCreateOpen(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] })} />
      <EditRawModal isOpen={isEditModalOpen} onClose={() => setIsEditOpen(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] })} initialData={editModalData} />
    </div>
  );
}