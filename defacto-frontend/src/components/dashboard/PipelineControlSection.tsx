'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'; 
import { useTranslations } from 'next-intl';
import { Play, RefreshCw, CheckCircle, XCircle, Clock, Plus, Trash2, Loader2, Filter, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'; 
import { triggerStructureEvents, getPipelineStatus, deleteRawEvent, deleteBulkRawEvents, getImpactAnalysis } from '@/lib/api/pipeline'; 
import CreateRawModal from '@/components/modals/CreateRawModal';
import EditRawModal from '@/components/modals/EditRawModal';
import useLocaleFormatter from '@/hooks/useLocaleFormatter';

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function PipelineControlSection() {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const queryClient = useQueryClient(); 
  const { formatDateOnly } = useLocaleFormatter();
  const baseEntityId = 1024; 

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(5);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [impactData, setImpactData] = useState<any>(null);
  const [targetDeleteRawId, setTargetDeleteRawId] = useState<number | null>(null);
  const [isImpactLoading, setIsImpactLoading] = useState(false);

  // --- Drag and Drop State for Impact Modal ---
  const [impactPos, setImpactPos] = useState({ x: 0, y: 0 });
  const [isImpactDragging, setIsImpactDragging] = useState(false);
  const impactDragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (!isImpactModalOpen) setImpactPos({ x: 0, y: 0 });
  }, [isImpactModalOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isImpactDragging) return;
      const deltaX = e.clientX - impactDragStart.current.x;
      const deltaY = e.clientY - impactDragStart.current.y;
      setImpactPos({
        x: impactDragStart.current.posX + deltaX,
        y: impactDragStart.current.posY + deltaY
      });
    };

    const handleMouseUp = () => {
      if (isImpactDragging) setIsImpactDragging(false);
    };

    if (isImpactDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isImpactDragging]);

  const handleImpactMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsImpactDragging(true);
    impactDragStart.current = { x: e.clientX, y: e.clientY, posX: impactPos.x, posY: impactPos.y };
  };
  // ------------------------------------------

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [startDate, endDate, limit, statusFilter]);

  const { data: pipelineStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['pipelineStatus', baseEntityId, page, limit, startDate, endDate, statusFilter],
    queryFn: () => getPipelineStatus({ baseEntityId, page, limit, startDate, endDate, statusFilter }),
    refetchInterval: 3000 
  });

  const currentMeta = pipelineStatus?.meta;

  const structureMutation = useMutation({
    mutationFn: async ({ ids, retry }: { ids: number[], retry: boolean }) => triggerStructureEvents(ids, baseEntityId, 'HierarchicalFactSchema', retry),
    onSuccess: () => { setSelectedIds([]); queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); },
    onError: () => alert(t('alert_backend_fail'))
  });

  const deleteMutation = useMutation({
    mutationFn: (rawId: number) => deleteRawEvent(rawId, baseEntityId),
    onSuccess: (data) => { 
      alert(data.message); 
      setIsImpactModalOpen(false);
      setSelectedIds(prev => prev.filter(id => id !== targetDeleteRawId));
      queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); 
    },
    onError: (error: any) => alert(error.response?.data?.detail || t('alert_del_fail'))
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (rawIds: number[]) => deleteBulkRawEvents(rawIds, baseEntityId),
    onSuccess: (data) => { alert(data.message); setSelectedIds([]); queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] }); },
    onError: (error: any) => alert(error.response?.data?.detail || t('alert_bulk_del_fail'))
  });

  const toggleSelectAll = () => {
    if (pipelineStatus?.data_list) {
      if (selectedIds.length === pipelineStatus.data_list.length && pipelineStatus.data_list.length > 0) setSelectedIds([]);
      else setSelectedIds(pipelineStatus.data_list.map((item: any) => item.raw_id));
    }
  };

  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSingleDeleteClick = async (rawId: number) => {
    setTargetDeleteRawId(rawId);
    setIsImpactLoading(true);
    try {
      const res = await getImpactAnalysis(rawId, baseEntityId);
      setImpactData(res);
      setIsImpactModalOpen(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || t('alert_impact_fail'));
    } finally {
      setIsImpactLoading(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    
    if (selectedIds.length === 1) {
      handleSingleDeleteClick(selectedIds[0]);
      return;
    }

    if (confirm(t('pipe_confirm_delete', { count: selectedIds.length }).replace(/\\n/g, '\n'))) {
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

  const openEditModal = (rawId: number, entityId: number, content: string, date: string) => {
    setEditModalData({ rawId, baseEntityId: entityId, content, date });
    setIsEditOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-600" /> {t('pipeline_control')}
        </h2>
        <button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-1 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> {t('pipe_manual_load')}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div onClick={() => setStatusFilter('ALL')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === 'ALL' ? 'bg-gray-800 border-gray-900 shadow-md' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === 'ALL' ? 'text-gray-300' : 'text-gray-500'}`}>{t('pipe_all')}</span>
          <span className={`text-xl font-bold ${statusFilter === 'ALL' ? 'text-white' : 'text-gray-800'}`}>{pipelineStatus?.total_count || 0}</span>
        </div>
        <div onClick={() => setStatusFilter('1')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === '1' ? 'bg-green-600 border-green-700 shadow-md' : 'bg-green-50 border-green-100 hover:bg-green-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === '1' ? 'text-green-100' : 'text-green-600'}`}>{t('pipe_synced')}</span>
          <span className={`text-xl font-bold ${statusFilter === '1' ? 'text-white' : 'text-green-700'}`}>{pipelineStatus?.success_count || 0}</span>
        </div>
        <div onClick={() => setStatusFilter('0')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === '0' ? 'bg-yellow-500 border-yellow-600 shadow-md' : 'bg-yellow-50 border-yellow-100 hover:bg-yellow-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === '0' ? 'text-yellow-100' : 'text-yellow-600'}`}>{t('pipe_pending')}</span>
          <span className={`text-xl font-bold ${statusFilter === '0' ? 'text-white' : 'text-yellow-700'}`}>{pipelineStatus?.pending_count || 0}</span>
        </div>
        <div onClick={() => setStatusFilter('2')} className={`border p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${statusFilter === '2' ? 'bg-red-600 border-red-700 shadow-md' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}>
          <span className={`text-xs font-medium ${statusFilter === '2' ? 'text-red-100' : 'text-red-600'}`}>{t('pipe_failed')}</span>
          <span className={`text-xl font-bold ${statusFilter === '2' ? 'text-white' : 'text-red-700'}`}>{pipelineStatus?.failed_count || 0}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 mt-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-600 hover:text-gray-900 border-r border-gray-200 pr-3">
            <input type="checkbox" checked={pipelineStatus?.data_list?.length > 0 && selectedIds.length === pipelineStatus.data_list.length} onChange={toggleSelectAll} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"/> {t('pipe_select_all')}
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
                {structureMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} {t('pipe_retry', { count: selectedIds.length })}
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending} className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-bold border border-red-200 shadow-sm disabled:opacity-50">
                {bulkDeleteMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {t('pipe_delete', { count: selectedIds.length })}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 border border-gray-200 rounded-xl bg-gray-50 p-2 overflow-hidden relative">
        {isStatusLoading || isImpactLoading ? (
          <p className="text-center text-gray-400 mt-10 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('pipe_processing')}
          </p>
        ) : (
          <ul className="space-y-2">
            {pipelineStatus?.data_list.length === 0 ? (
              <p className="text-center text-gray-400 mt-10 text-sm font-bold">{t('pipe_no_data')}</p>
            ) : pipelineStatus?.data_list.map((item: any) => (
              <li key={item.raw_id} onClick={() => toggleSelect(item.raw_id)} onDoubleClick={() => openEditModal(item.raw_id, item.base_entity_id, item.raw_content, item.event_date)} title={t('tooltip_edit')} className={`bg-white p-3 rounded-lg border shadow-sm flex flex-col gap-1 transition-all cursor-pointer ${selectedIds.includes(item.raw_id) ? 'border-blue-400 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(item.raw_id)} onChange={() => toggleSelect(item.raw_id)} className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"/>
                    <span className="text-xs font-bold text-gray-500">ID: {item.raw_id}</span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{item.event_date ? formatDateOnly(item.event_date) : t('pipe_unknown_date')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.sync_status_id === 1 && <span className="flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3"/> {t('pipe_synced')}</span>}
                    {item.sync_status_id === 2 && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3"/> {t('pipe_failed')}</span>}
                    {item.sync_status_id === 0 && <span className="flex items-center gap-1 text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3"/> {t('pipe_pending')}</span>}
                  </div>
                </div>
                <p className={`text-sm ml-6 font-medium ${item.raw_content ? 'text-gray-800' : 'text-gray-400 italic'}`} title={item.raw_content}>{item.raw_content || t('pipe_extracting')}</p>
                {item.error_log && <p className="text-[10px] text-red-500 mt-1 ml-6 bg-red-50 p-1 rounded font-bold">{t('pipe_error')} {item.error_log}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border border-gray-200 bg-white shadow-sm p-3 rounded-xl">
        <span className="text-xs font-bold text-gray-500 pl-1">{t('pipe_total', { count: currentMeta?.total_count || 0 })}</span>
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
          <option value={5}>{t('pipe_view_5')}</option>
          <option value={10}>{t('pipe_view_10')}</option>
          <option value={20}>{t('pipe_view_20')}</option>
          <option value={50}>{t('pipe_view_50')}</option>
        </select>
      </div>

      {isImpactModalOpen && impactData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div 
             className="bg-white rounded-2xl flex flex-col shadow-2xl border border-gray-100 relative"
             style={{
               transform: `translate(${impactPos.x}px, ${impactPos.y}px)`,
               width: '600px',
               minWidth: '400px',
               minHeight: '300px',
               maxHeight: '90vh',
               resize: 'both',
               overflow: 'hidden'
             }}
           >
              <div 
                className="px-6 py-5 flex items-center justify-between border-b border-gray-100 shrink-0 cursor-move select-none"
                onMouseDown={handleImpactMouseDown}
              >
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 pointer-events-none">
                  <AlertTriangle className="w-6 h-6 text-amber-500" /> {t('pipe_impact_title')} (Raw ID: {targetDeleteRawId})
                </h3>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {impactData.affected_count > 0 ? (
                  <div className="mb-4 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
                    <p className="font-bold mb-2">{t('pipe_impact_warn', { count: impactData.affected_count })}</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                       {impactData.affected_items.map((it: any, i: number) => (
                          <li key={i}>[{it.item_type}] ID {it.item_id}: {it.title_or_summary}</li>
                       ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mb-4 text-emerald-700 bg-emerald-50 p-4 rounded-xl font-bold border border-emerald-200">
                    {t('pipe_impact_safe')}
                  </p>
                )}
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                   <label className="flex items-start gap-3 cursor-pointer">
                      <input type="radio" checked readOnly className="mt-1 w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-gray-800">
                         {t('pipe_impact_soft')}
                         <span className="block text-xs font-normal text-gray-500 mt-1">
                           {t('pipe_impact_soft_desc')}
                         </span>
                      </span>
                   </label>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
                 <button onClick={() => setIsImpactModalOpen(false)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">{tCommon('cancel')}</button>
                 <button onClick={() => {
                    if (targetDeleteRawId) deleteMutation.mutate(targetDeleteRawId);
                 }} disabled={deleteMutation.isPending} className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
                   {deleteMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />} {t('pipe_impact_approve')}
                 </button>
              </div>
           </div>
        </div>
      )}

      <CreateRawModal isOpen={isCreateModalOpen} onClose={() => setIsCreateOpen(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] })} />
      
      <EditRawModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditOpen(false)} 
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['pipelineStatus'] })} 
        initialData={editModalData} 
        onDeleteRequest={(rawId) => {
          setIsEditOpen(false);
          handleSingleDeleteClick(rawId);
        }}
      />
    </div>
  );
}