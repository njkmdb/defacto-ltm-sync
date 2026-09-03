'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import Papa from 'papaparse';
import { Calendar, Trash2, XCircle, LayoutGrid, List as ListIcon, Plus, Download, UploadCloud, ChevronLeft, ChevronRight, Search, X, AlertCircle, Edit2, User, FileText, ListTodo, RefreshCw, Save, Sparkles, Database } from 'lucide-react';
import { getEventLog, getEventLogs, saveContextSummary, deleteEventLog, deleteBulkEventLogs, bulkUpsertEventLogs } from '@/lib/api/archive';
import useLocaleFormatter from '@/hooks/useLocaleFormatter';
import ArchiveModals from './ArchiveModals';
import ArchiveSearchConditions, { SearchCondition } from './ArchiveSearchConditions';

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function LogArchiveView() {
  const t = useTranslations('Archive');
  const locale = useLocale(); 
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { formatDateOnly } = useLocaleFormatter();
  const searchParams = useSearchParams();

  const focusId = searchParams.get('focusId');
  const entityIdParam = searchParams.get('entityId');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: 'SUMMARY', keyword: '', operator: 'AND' }]);
  const [appliedConditions, setAppliedConditions] = useState<SearchCondition[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('LIST');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewErrors, setPreviewErrors] = useState(0);

  const [formData, setFormData] = useState({ base_entity_id: '' as string | number, log_date: new Date().toISOString().split('T')[0], llm_summary: '', action_items: [] as any[] });

  // 💡 라우팅을 통한 모달 자동 개방 로직
  useEffect(() => {
    if (focusId && entityIdParam) {
      getEventLog(Number(focusId), Number(entityIdParam)).then(res => {
        const log = res.data;
        setSelectedLogId(log.log_id);
        setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] });
        setIsModalOpen(true);
        
        // Clean-up URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }).catch(err => {
        console.error(err);
      });
    }
  }, [focusId, entityIdParam]);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['eventLogs', page, limit, startDate, endDate, appliedConditions],
    queryFn: () => getEventLogs(page, limit, startDate, endDate, appliedConditions),
  });

  const saveMutation = useMutation({ mutationFn: async (payload: any) => saveContextSummary(Number(payload.base_entity_id), payload.log_date, payload.llm_summary, payload.action_items, payload.log_id), onSuccess: () => { alert(t('alert_save_success')); setIsModalOpen(false); queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); } });
  
  const deleteMutation = useMutation({ 
    mutationFn: async ({ id, baseEntityId }: { id: number, baseEntityId: number }) => await deleteEventLog(id, baseEntityId), 
    onSuccess: (data) => { 
      alert(data.message); 
      queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); 
    } 
  });
  
  const bulkDeleteMutation = useMutation({ 
    mutationFn: async (ids: number[]) => await deleteBulkEventLogs(ids, logsData?.data?.find((l: any) => ids.includes(l.log_id))?.base_entity_id || 1024), 
    onSuccess: (data) => { 
      alert(data.message); 
      setSelectedIds([]); 
      queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); 
    } 
  });
  
  const bulkUpsertMutation = useMutation({ mutationFn: bulkUpsertEventLogs, onSuccess: (data) => { alert(data.message); setIsPreviewOpen(false); setSelectedIds([]); queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); } });

  const resetFilters = () => { setStartDate(''); setEndDate(''); setConditions([{ id: Date.now(), target: 'SUMMARY', keyword: '', operator: 'AND' }]); setAppliedConditions([]); setPage(1); };
  const toggleSelectAll = () => { if (logsData?.data) { setSelectedIds(selectedIds.length === logsData.data.length && logsData.data.length > 0 ? [] : logsData.data.map((log: any) => log.log_id)); } };
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    const flatData = (logsData?.data.filter((i: any) => selectedIds.includes(i.log_id)) || []).map((log: any) => ({ LOG_ID: log.log_id, BASE_ENTITY_ID: log.base_entity_id, DATE: log.log_date, SUMMARY: log.llm_summary, ACTION_ITEMS: JSON.stringify(log.action_items || []) }));
    const blob = new Blob(["\uFEFF" + Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `defacto_logs_export.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleGoToStudio = () => {
    if (selectedIds.length === 0) return;
    const selectedData = logsData?.data?.filter((i: any) => selectedIds.includes(i.log_id)) || [];
    const sourcesQuery = selectedData.map((item: any) => `LOG:${item.log_id}:${item.base_entity_id}`).join(',');
    router.push(`/${locale}/studio?sources=${sourcesQuery}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        let errCount = 0;
        const parsed = results.data.map((row: any, index: number) => {
          const baseEntityId = row.BASE_ENTITY_ID ? Number(row.BASE_ENTITY_ID) : null;
          let actionItems = []; if (row.ACTION_ITEMS) { try { actionItems = JSON.parse(row.ACTION_ITEMS); } catch(e) {} }
          const hasError = !baseEntityId || !row.DATE?.trim() || !row.SUMMARY?.trim();
          if (hasError) errCount++;
          return { index: index + 1, log_id: row.LOG_ID ? Number(row.LOG_ID) : null, base_entity_id: baseEntityId, log_date: row.DATE?.trim(), llm_summary: row.SUMMARY?.trim(), action_items: actionItems, hasError };
        });
        setPreviewData(parsed); setPreviewErrors(errCount); setIsPreviewOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const handleSearchApply = () => {
    setPage(1);
    setAppliedConditions([...conditions]);
  };

  const currentMeta = logsData?.meta;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4"/> {t('filter_date')}</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 h-10">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none text-sm font-semibold text-gray-700 cursor-pointer"/>
                <span className="text-gray-400 font-bold">~</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none text-sm font-semibold text-gray-700 cursor-pointer"/>
              </div>
            </div>
            {(startDate || endDate || appliedConditions.length > 0) && <div className="pt-7"><button onClick={resetFilters} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> {t('filter_reset')}</button></div>}
          </div>
          <div className="flex items-center gap-3 mt-7">
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button onClick={() => setViewMode('CARD')} className={`p-1.5 rounded-md ${viewMode === 'CARD' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><LayoutGrid size={18}/></button>
              <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md ${viewMode === 'LIST' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><ListIcon size={18}/></button>
            </div>
            {selectedIds.length === 0 ? (
              <>
                <input type="file" ref={fileInputRef} accept=".csv, .tsv" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm"><UploadCloud className="w-4 h-4" /> {t('btn_bulk_upload')}</button>
                <button onClick={() => { setSelectedLogId(null); setFormData({ base_entity_id: '', log_date: new Date().toISOString().split('T')[0], llm_summary: '', action_items: [] }); setIsModalOpen(true); }} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg font-bold text-sm shadow-md"><Plus className="w-4 h-4" /> {t('btn_manual_write')}</button>
              </>
            ) : (
              <>
                <button onClick={handleExport} className="flex items-center gap-1.5 bg-gray-800 text-white hover:bg-black transition-colors px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm"><Download className="w-4 h-4" /> {t('btn_export', { count: selectedIds.length })}</button>
                <button onClick={handleGoToStudio} className="flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 transition-colors px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-md"><Sparkles className="w-4 h-4" /> {t('btn_studio', { count: selectedIds.length })}</button>
                <button onClick={() => { if(confirm(t('confirm_delete_multi', { count: selectedIds.length }))) bulkDeleteMutation.mutate(selectedIds); }} className="flex items-center gap-1 text-sm bg-red-50 hover:bg-red-100 transition-colors text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold"><Trash2 className="w-4 h-4" /> {t('btn_delete', { count: selectedIds.length })}</button>
              </>
            )}
          </div>
        </div>
        
        <ArchiveSearchConditions 
          conditions={conditions} 
          setConditions={setConditions} 
          onSearch={handleSearchApply} 
          viewType="LOG"
        />
      </div>

      {isLoading ? <div className="py-20 text-center text-gray-400 font-bold flex flex-col items-center"><RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-300" /> {t('state_loading')}</div> :
       logsData?.data?.length === 0 ? <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300"><Search className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-bold">{t('state_empty_logs')}</p></div> :
       viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {logsData.data.map((log: any) => {
            const isSelected = selectedIds.includes(log.log_id);
            return (
              <div key={log.log_id} onClick={() => toggleSelect(log.log_id)} onDoubleClick={() => { setSelectedLogId(log.log_id); setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] }); setIsModalOpen(true); }} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all cursor-pointer ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(log.log_id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" onClick={(e) => e.stopPropagation()}/>
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-extrabold">{formatDateOnly(log.log_date)}</span>
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-1"><User className="w-3.5 h-3.5"/> Entity ID: {log.base_entity_id}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedLogId(log.log_id); setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] }); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm(t('confirm_delete_single'))) deleteMutation.mutate({ id: log.log_id, baseEntityId: log.base_entity_id }); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div><h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1 uppercase"><FileText className="w-3.5 h-3.5"/> {t('col_summary')}</h4><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{log.llm_summary}</p></div>
                  {log.action_items?.length > 0 && (
                    <div className="mt-auto pt-4 border-t border-gray-100"><h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1 uppercase"><ListTodo className="w-3.5 h-3.5"/> {t('col_action_items')}</h4><ul className="space-y-2">{log.action_items.map((item: any, idx: number) => <li key={idx} className="flex items-start gap-2 bg-gray-50 px-3 py-2 rounded border border-gray-100"><span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded shrink-0">{item.due_date || 'N/A'}</span><p className="text-xs text-gray-800 mt-0.5">{item.task}</p></li>)}</ul></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-12 text-center"><input type="checkbox" checked={selectedIds.length === logsData.data.length && logsData.data.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" /></th>
                <th className="p-3 w-20 text-xs font-extrabold text-gray-500 uppercase tracking-wider">{t('col_log_id')}</th>
                <th className="p-3 w-28 text-xs font-extrabold text-gray-500 uppercase tracking-wider">{t('col_entity_id')}</th>
                <th className="p-3 w-32 text-xs font-extrabold text-gray-500 uppercase tracking-wider">{t('col_date')}</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider min-w-[300px]">{t('col_summary')}</th>
                <th className="p-3 w-32 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">{t('col_action_items')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logsData.data.map((log: any) => {
                const isSelected = selectedIds.includes(log.log_id);
                return (
                  <tr key={log.log_id} onClick={() => toggleSelect(log.log_id)} onDoubleClick={() => { setSelectedLogId(log.log_id); setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] }); setIsModalOpen(true); }} className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`} title={t('tooltip_edit')}>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(log.log_id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" /></td>
                    <td className="p-3 text-sm font-bold text-gray-700">{log.log_id}</td>
                    <td className="p-3 text-sm font-bold text-gray-600">{log.base_entity_id}</td>
                    <td className="p-3"><span className="text-[10px] font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded">{formatDateOnly(log.log_date)}</span></td>
                    <td className="p-3 text-sm text-gray-800 truncate max-w-[600px] overflow-hidden">{log.llm_summary}</td>
                    <td className="p-3 text-center">{log.action_items?.length > 0 ? <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{log.action_items.length} Tasks</span> : <span className="text-xs text-gray-300">-</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {currentMeta && (
        <div className="p-4 mt-6 border border-gray-200 bg-white shadow-sm rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500 pl-2">{t('total_count', { count: currentMeta.total_count })}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex gap-1">
              {getPageNumbers(page, currentMeta.total_pages).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-gray-600">
            <option value={10}>{t('view_10')}</option>
            <option value={20}>{t('view_20')}</option>
            <option value={50}>{t('view_50')}</option>
          </select>
        </div>
      )}

      <ArchiveModals 
        isPreviewOpen={isPreviewOpen} setIsPreviewOpen={setIsPreviewOpen}
        previewData={previewData} previewErrors={previewErrors}
        handleBulkUpsertConfirm={() => { if(previewErrors === 0) bulkUpsertMutation.mutate(previewData); else alert(t('alert_fix_errors')); }}
        isBulkPending={bulkUpsertMutation.isPending}
        isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
        selectedLogId={selectedLogId} formData={formData} setFormData={setFormData}
        handleSave={() => { if(!formData.base_entity_id || !formData.llm_summary) return alert(t('alert_req_fields')); saveMutation.mutate({ ...formData, log_id: selectedLogId }); }}
        isSavePending={saveMutation.isPending}
      />
    </>
  );
}