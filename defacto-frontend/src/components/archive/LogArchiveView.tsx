'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Calendar, Trash2, XCircle, LayoutGrid, List as ListIcon, Plus, Download, UploadCloud, ChevronLeft, ChevronRight, Search, X, AlertCircle, Edit2, User, FileText, ListTodo, RefreshCw, Save, Sparkles, Database } from 'lucide-react';
import { getEventLogs, saveContextSummary, deleteEventLog, deleteBulkEventLogs, bulkUpsertEventLogs } from '@/lib/api/archive';

type SearchCondition = { id: number; target: string; keyword: string; operator: 'AND' | 'OR'; };

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function LogArchiveView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['eventLogs', page, limit, startDate, endDate, appliedConditions],
    queryFn: () => getEventLogs(page, limit, startDate, endDate, appliedConditions),
  });

  const saveMutation = useMutation({ mutationFn: async (payload: any) => saveContextSummary(Number(payload.base_entity_id), payload.log_date, payload.llm_summary, payload.action_items, payload.log_id), onSuccess: () => { alert("저장되었습니다."); setIsModalOpen(false); queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); } });
  const deleteMutation = useMutation({ mutationFn: deleteEventLog, onSuccess: (data) => { alert(data.message); queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); } });
  const bulkDeleteMutation = useMutation({ mutationFn: deleteBulkEventLogs, onSuccess: (data) => { alert(data.message); setSelectedIds([]); queryClient.invalidateQueries({ queryKey: ['eventLogs'] }); } });
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
    router.push(`/studio?sources=${sourcesQuery}`);
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

  const currentMeta = logsData?.meta;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4"/> 조회 기간</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 h-10">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none text-sm font-semibold text-gray-700 cursor-pointer"/>
                <span className="text-gray-400 font-bold">~</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none text-sm font-semibold text-gray-700 cursor-pointer"/>
              </div>
            </div>
            {(startDate || endDate || appliedConditions.length > 0) && <div className="pt-7"><button onClick={resetFilters} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> 전체 초기화</button></div>}
          </div>
          <div className="flex items-center gap-3 mt-7">
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button onClick={() => setViewMode('CARD')} className={`p-1.5 rounded-md ${viewMode === 'CARD' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><LayoutGrid size={18}/></button>
              <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md ${viewMode === 'LIST' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><ListIcon size={18}/></button>
            </div>
            {selectedIds.length === 0 ? (
              <>
                <input type="file" ref={fileInputRef} accept=".csv, .tsv" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm"><UploadCloud className="w-4 h-4" /> 일괄 주입</button>
                <button onClick={() => { setSelectedLogId(null); setFormData({ base_entity_id: '', log_date: new Date().toISOString().split('T')[0], llm_summary: '', action_items: [] }); setIsModalOpen(true); }} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg font-bold text-sm shadow-md"><Plus className="w-4 h-4" /> 수동 작성</button>
              </>
            ) : (
              <>
                <button onClick={handleExport} className="flex items-center gap-1.5 bg-gray-800 text-white hover:bg-black transition-colors px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm"><Download className="w-4 h-4" /> 추출 ({selectedIds.length})</button>
                <button onClick={handleGoToStudio} className="flex items-center gap-1.5 bg-purple-600 text-white hover:bg-purple-700 transition-colors px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-md"><Sparkles className="w-4 h-4" /> 창작 ({selectedIds.length})</button>
                <button onClick={() => { if(confirm(`선택한 ${selectedIds.length}개의 일지를 삭제하시겠습니까?`)) bulkDeleteMutation.mutate(selectedIds); }} className="flex items-center gap-1 text-sm bg-red-50 hover:bg-red-100 transition-colors text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold"><Trash2 className="w-4 h-4" /> 삭제 ({selectedIds.length})</button>
              </>
            )}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <label className="block text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-indigo-600"/> 다중 조건 검색</label>
          <div className="flex flex-col gap-3">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                {idx > 0 ? <select value={cond.operator} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as 'AND' | 'OR' } : c))} className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1.5 w-20 text-center shadow-sm"><option value="AND">AND</option><option value="OR">OR</option></select> : <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">WHERE</span>}
                <select value={cond.target} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, target: e.target.value } : c))} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-40 shadow-sm"><option value="SUMMARY">Summary</option><option value="ENTITY_ID">Entity ID</option><option value="LOG_ID">Log ID</option><option value="ACTION_ITEMS">Action Items</option></select>
                <input type="text" value={cond.keyword} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, keyword: e.target.value } : c))} onKeyDown={(e) => e.key === 'Enter' && setAppliedConditions([...conditions])} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-indigo-400" />
                {conditions.length > 1 && <button onClick={() => setConditions(conditions.filter(c => c.id !== cond.id))} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded"><X className="w-4 h-4" /></button>}
                {idx === conditions.length - 1 && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'SUMMARY', keyword: '', operator: 'AND' }])} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> AND</button>
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'SUMMARY', keyword: '', operator: 'OR' }])} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> OR</button>
                    <button onClick={() => setAppliedConditions([...conditions])} className="bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 shadow-sm ml-1"><Search className="w-4 h-4" /> 검색 적용</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? <div className="py-20 text-center text-gray-400 font-bold flex flex-col items-center"><RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-300" /> 불러오는 중...</div> :
       logsData?.data?.length === 0 ? <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300"><Search className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-bold">조건에 일치하는 일지가 없습니다.</p></div> :
       viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {logsData.data.map((log: any) => {
            const isSelected = selectedIds.includes(log.log_id);
            return (
              <div key={log.log_id} onClick={() => toggleSelect(log.log_id)} onDoubleClick={() => { setSelectedLogId(log.log_id); setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] }); setIsModalOpen(true); }} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all cursor-pointer ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(log.log_id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" onClick={(e) => e.stopPropagation()}/>
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-extrabold">{log.log_date}</span>
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-1"><User className="w-3.5 h-3.5"/> Entity ID: {log.base_entity_id}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedLogId(log.log_id); setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] }); setIsModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); if(confirm("영구 삭제하시겠습니까?")) deleteMutation.mutate(log.log_id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div><h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1 uppercase"><FileText className="w-3.5 h-3.5"/> Summary</h4><p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{log.llm_summary}</p></div>
                  {log.action_items?.length > 0 && (
                    <div className="mt-auto pt-4 border-t border-gray-100"><h4 className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1 uppercase"><ListTodo className="w-3.5 h-3.5"/> Action Items</h4><ul className="space-y-2">{log.action_items.map((item: any, idx: number) => <li key={idx} className="flex items-start gap-2 bg-gray-50 px-3 py-2 rounded border border-gray-100"><span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] font-bold rounded shrink-0">{item.due_date || 'N/A'}</span><p className="text-xs text-gray-800 mt-0.5">{item.task}</p></li>)}</ul></div>
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
                <th className="p-3 w-20 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Log ID</th>
                <th className="p-3 w-28 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Entity ID</th>
                <th className="p-3 w-32 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider min-w-[300px]">Summary</th>
                <th className="p-3 w-32 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Action Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logsData.data.map((log: any) => {
                const isSelected = selectedIds.includes(log.log_id);
                return (
                  <tr key={log.log_id} onClick={() => toggleSelect(log.log_id)} onDoubleClick={() => { setSelectedLogId(log.log_id); setFormData({ base_entity_id: log.base_entity_id, log_date: log.log_date, llm_summary: log.llm_summary, action_items: log.action_items || [] }); setIsModalOpen(true); }} className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(log.log_id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" /></td>
                    <td className="p-3 text-sm font-bold text-gray-700">{log.log_id}</td>
                    <td className="p-3 text-sm font-bold text-gray-600">{log.base_entity_id}</td>
                    <td className="p-3"><span className="text-[10px] font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded">{log.log_date}</span></td>
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
          <span className="text-sm font-bold text-gray-500 pl-2">총 {currentMeta.total_count} 건</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex gap-1">
              {getPageNumbers(page, currentMeta.total_pages).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold ${page === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-gray-600">
            <option value={10}>10개씩 보기</option><option value={20}>20개씩 보기</option><option value={50}>50개씩 보기</option>
          </select>
        </div>
      )}

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl w-[1200px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"><div className="p-6 border-b bg-blue-50/50 flex justify-between"><div><h2 className="text-xl font-extrabold flex items-center gap-2"><UploadCloud className="w-6 h-6 text-blue-600" /> 대량 주입 미리보기</h2><p className="text-sm mt-1">총 {previewData.length}개의 레코드를 발견했습니다.</p></div><button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded"><X className="w-6 h-6"/></button></div><div className="flex-1 overflow-auto p-6 bg-gray-50/50">{previewErrors > 0 && <div className="mb-4 p-3 bg-red-50 text-red-700 font-bold flex items-center gap-2"><AlertCircle className="w-5 h-5" /> 누락된 불량 레코드가 {previewErrors}건 있습니다.</div>}<table className="w-full text-left bg-white shadow-sm text-sm"><thead className="bg-gray-100 text-xs text-gray-500 uppercase"><tr><th className="p-3">Row</th><th className="p-3">Log ID</th><th className="p-3">Entity ID</th><th className="p-3">Date</th><th className="p-3">Summary</th></tr></thead><tbody>{previewData.map((r, i) => <tr key={i} className={r.hasError ? 'bg-red-50' : 'hover:bg-gray-50'}><td className="p-3">{r.index}</td><td className="p-3">{r.log_id || '자동발급'}</td><td className="p-3">{r.base_entity_id || '누락'}</td><td className="p-3">{r.log_date || '누락'}</td><td className="p-3 truncate max-w-xs">{r.llm_summary || '누락'}</td></tr>)}</tbody></table></div><div className="p-6 border-t flex justify-end gap-3 bg-white"><button onClick={() => setIsPreviewOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">취소</button><button onClick={() => { if(previewErrors === 0) bulkUpsertMutation.mutate(previewData); else alert("오류를 수정해주세요."); }} disabled={previewErrors > 0 || bulkUpsertMutation.isPending} className="flex items-center gap-2 text-white px-8 py-2.5 rounded-lg font-bold bg-blue-600 disabled:opacity-50"><Database className="w-5 h-5"/> 최종 확정</button></div></div>
        </div>
      )}

      {/* 💡 개선된 단기 일지 교정 모달 (상하 높이 롤백 및 fit-content 적용) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          {/* h-[85vh] 제거, max-h-[90vh] 사용으로 억지로 길어지지 않게 함 */}
          <div className="bg-gray-50 rounded-2xl w-[1000px] max-w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            
            {/* Header */}
            <div className="bg-gray-900 p-5 flex items-center justify-between shrink-0">
              <div className="text-white">
                <h2 className="text-xl font-extrabold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" /> 
                  {selectedLogId ? `단기 일지 교정 (Log ID: ${selectedLogId})` : '수동 일지 작성'}
                </h2>
                <p className="text-xs text-gray-400 mt-1">AI 합성 일지를 검수하고 후속 업무를 수정할 수 있습니다.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6"/></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <label className="text-xs font-extrabold text-gray-500 uppercase mb-2 flex items-center gap-1.5"><User className="w-4 h-4 text-indigo-500"/> Entity ID <span className="text-red-500">*</span></label>
                  <input type="number" value={formData.base_entity_id} onChange={(e) => setFormData({...formData, base_entity_id: e.target.value})} className="w-full font-bold text-gray-800 outline-none text-lg border-b border-transparent focus:border-indigo-300 transition-colors bg-transparent" placeholder="주체 ID 입력" />
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <label className="text-xs font-extrabold text-gray-500 uppercase mb-2 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-indigo-500"/> Event Date <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.log_date} onChange={(e) => setFormData({...formData, log_date: e.target.value})} className="w-full font-bold text-gray-800 outline-none text-lg border-b border-transparent focus:border-indigo-300 transition-colors cursor-pointer bg-transparent" />
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl flex justify-between items-center shrink-0">
                   <label className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5"><FileText className="w-4 h-4 text-indigo-500"/> 요약 내용 (Summary) <span className="text-red-500">*</span></label>
                </div>
                {/* h-[400px]에서 h-48(약 192px)로 변경 */}
                <textarea value={formData.llm_summary} onChange={(e) => setFormData({...formData, llm_summary: e.target.value})} className="w-full h-48 p-5 outline-none resize-none leading-relaxed text-gray-700 text-[15px] focus:bg-indigo-50/10 transition-colors rounded-b-xl" placeholder="일지 내용을 입력하세요..." />
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                  <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5"><ListTodo className="w-4 h-4 text-indigo-500"/> Action Items (후속 업무)</h3>
                  <button onClick={() => setFormData({...formData, action_items: [...formData.action_items, {task: '', due_date: ''}]})} className="text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"><Plus className="w-3.5 h-3.5"/> 업무 추가</button>
                </div>
                {/* min-h-[250px] 제거 및 max-h 지정 */}
                <div className="p-5 bg-gray-50 flex-1 overflow-y-auto space-y-3 max-h-[300px]">
                  {formData.action_items.length === 0 && <p className="text-sm text-gray-400 font-bold text-center py-6">할당된 후속 업무가 없습니다.</p>}
                  {formData.action_items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm items-center transition-all focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300">
                      <div className="flex flex-col w-32 shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Due Date</span>
                        <input type="date" value={item.due_date} onChange={(e) => { const n = [...formData.action_items]; n[idx].due_date = e.target.value; setFormData({...formData, action_items: n}); }} className="w-full border-none outline-none font-bold text-gray-600 text-sm cursor-pointer bg-transparent" />
                      </div>
                      <div className="w-px h-8 bg-gray-200 mx-2"></div>
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Task Description</span>
                        <input type="text" value={item.task} onChange={(e) => { const n = [...formData.action_items]; n[idx].task = e.target.value; setFormData({...formData, action_items: n}); }} placeholder="수행할 업무 내용 입력" className="w-full border-none outline-none text-sm font-medium text-gray-800 bg-transparent truncate" />
                      </div>
                      <button onClick={() => { const n = [...formData.action_items]; n.splice(idx, 1); setFormData({...formData, action_items: n}); }} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 ml-2"><X className="w-5 h-5"/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={() => { if(!formData.base_entity_id || !formData.llm_summary) return alert("필수 입력 확인"); saveMutation.mutate({ ...formData, log_id: selectedLogId }); }} disabled={saveMutation.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md">
                {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 일지 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}