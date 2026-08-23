'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Search, Plus, Trash2, UploadCloud, XCircle, ChevronLeft, ChevronRight, RefreshCw, X, AlertCircle, Database, Save, Tags, Lock } from 'lucide-react';
import { getStatuses, createStatus, updateStatus, deleteStatus, deleteBulkStatuses, bulkUpsertStatuses } from '@/lib/api/master';

type SearchCondition = { id: number; target: string; keyword: string; operator: 'AND' | 'OR'; };

// 💡 [결함 수정] Pagination Windowing Helper 적용
const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function StatusView() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }]);
  const [appliedConditions, setAppliedConditions] = useState<SearchCondition[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewErrors, setPreviewErrors] = useState(0);

  const [formData, setFormData] = useState({ id: '' as string | number, name: '', type: 'ENTITY', is_active: true, ne_ts: '', up_ts: '' });

  const currentFilterTypes = ['SYSTEM', 'ENTITY', 'OBJECT', 'TRANSACTION', 'WORKFLOW'];
  const { data: statusesData, isLoading } = useQuery({ queryKey: ['statuses', page, limit, typeFilter, appliedConditions], queryFn: () => getStatuses(page, limit, typeFilter, appliedConditions) });

  const handleSuccess = (msg: string) => { alert(msg); setIsModalOpen(false); setIsPreviewOpen(false); queryClient.invalidateQueries({ queryKey: ['statuses'] }); queryClient.invalidateQueries({ queryKey: ['statusOptions'] }); };
  const handleError = (err: any) => alert(err.response?.data?.detail || "오류 발생");

  const createMut = useMutation({ mutationFn: createStatus, onSuccess: () => handleSuccess("저장 성공"), onError: handleError });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number, data: any }) => updateStatus(id, data), onSuccess: () => handleSuccess("수정 성공"), onError: handleError });
  const deleteMut = useMutation({ mutationFn: deleteStatus, onSuccess: () => { handleSuccess("삭제 성공"); setSelectedId(null); setIsModalOpen(false); }, onError: handleError });
  const bulkDeleteMut = useMutation({ mutationFn: deleteBulkStatuses, onSuccess: () => { handleSuccess("일괄 삭제 성공"); setSelectedIds([]); }, onError: handleError });
  const bulkUpsertMut = useMutation({ mutationFn: bulkUpsertStatuses, onSuccess: () => handleSuccess("일괄 주입 성공"), onError: handleError });

  const currentMeta = statusesData?.meta;
  const currentDataList = statusesData?.data || [];

  const toggleSelectAll = () => {
    const selectable = currentDataList.filter((i: any) => i.status_id >= 10).map((i: any) => i.status_id);
    setSelectedIds(selectedIds.length === selectable.length && selectable.length > 0 ? [] : selectable);
  };
  const toggleSelect = (id: number) => { if (id >= 10) setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        let errCount = 0;
        const parsed = results.data.map((row: any, index: number) => {
          const type = row.CATEGORY?.trim(); const name = row.NAME?.trim(); const id = row.ID ? Number(row.ID) : null;
          const isActive = row.IS_ACTIVE?.toUpperCase() !== 'FALSE';
          if (!type || !name || !id) errCount++;
          return { index: index + 1, id, type, name, is_active: isActive, hasError: !type || !name || !id };
        });
        setPreviewData(parsed); setPreviewErrors(errCount); setIsPreviewOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.type.trim() || !formData.id) return alert("ID, 이름, 카테고리는 필수입니다.");
    const payload = { status_id: Number(formData.id), domain_category: formData.type.toUpperCase(), status_name: formData.name, is_active: formData.is_active };
    selectedId ? updateMut.mutate({ id: selectedId, data: payload }) : createMut.mutate(payload);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Search className="w-4 h-4"/> 퀵 필터</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 h-10 outline-none">
                <option value="ALL">모든 카테고리 보기</option>{currentFilterTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(typeFilter !== 'ALL' || appliedConditions.length > 0) && <div className="pt-7"><button onClick={() => { setTypeFilter('ALL'); setConditions([{ id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }]); setAppliedConditions([]); }} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm"><XCircle className="w-4 h-4 inline" /> 초기화</button></div>}
          </div>
          <div className="flex items-center gap-3 mt-7">
            {selectedIds.length === 0 ? (
              <><input type="file" ref={fileInputRef} accept=".csv, .tsv" onChange={handleFileUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold"><UploadCloud className="w-4 h-4 inline" /> 주입</button><button onClick={() => { setSelectedId(null); setFormData({ id: '', name: '', type: 'ENTITY', is_active: true, ne_ts: '', up_ts: '' }); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold"><Plus className="w-4 h-4 inline" /> 등록</button></>
            ) : (
              <><button onClick={() => confirm("일괄 삭제하시겠습니까?") && bulkDeleteMut.mutate(selectedIds)} disabled={bulkDeleteMut.isPending} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold"><Trash2 className="w-4 h-4 inline" /> 삭제 ({selectedIds.length})</button></>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <label className="block text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-indigo-600"/> 다중 조건 상세 검색</label>
          <div className="flex flex-col gap-3">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                {idx > 0 ? <select value={cond.operator} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as 'AND'|'OR' } : c))} className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1.5 w-20 text-center shadow-sm"><option value="AND">AND</option><option value="OR">OR</option></select> : <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">WHERE</span>}
                <select value={cond.target} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, target: e.target.value } : c))} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-40 shadow-sm"><option value="NAME">Name</option><option value="ID">ID</option><option value="CATEGORY">Category</option></select>
                <input type="text" value={cond.keyword} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, keyword: e.target.value } : c))} onKeyDown={(e) => e.key === 'Enter' && setAppliedConditions([...conditions])} className="px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md w-[27rem] font-medium" />
                {conditions.length > 1 && <button onClick={() => setConditions(conditions.filter(c => c.id !== cond.id))} className="text-gray-400 hover:text-red-500 p-1.5"><X className="w-4 h-4" /></button>}
                {idx === conditions.length - 1 && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }])} className="text-xs font-bold text-gray-600 bg-white border px-3 py-1.5 rounded-md"><Plus className="w-3 h-3 inline" /> AND</button>
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'NAME', keyword: '', operator: 'OR' }])} className="text-xs font-bold text-gray-600 bg-white border px-3 py-1.5 rounded-md"><Plus className="w-3 h-3 inline" /> OR</button>
                    <button onClick={() => setAppliedConditions([...conditions])} className="bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm font-bold"><Search className="w-4 h-4 inline" /> 검색</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
        {isLoading ? <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-indigo-500" /></div> : currentDataList.length === 0 ? <p className="text-center text-gray-400 font-bold py-20">데이터가 없습니다.</p> : (
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-12 text-center"><input type="checkbox" checked={currentDataList.length > 0 && selectedIds.length === currentDataList.filter((i:any)=>i.status_id >= 10).length} onChange={toggleSelectAll} className="w-4 h-4 rounded text-indigo-600" /></th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">ID</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Category</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Name</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase text-center">Status</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentDataList.map((row: any) => (
                <tr key={row.status_id} onClick={() => toggleSelect(row.status_id)} onDoubleClick={() => { if(row.status_id>=10){ setSelectedId(row.status_id); setFormData({ id: row.status_id, name: row.status_name, type: row.domain_category, is_active: row.is_active, ne_ts: row.ne_ts, up_ts: row.up_ts }); setIsModalOpen(true); } }} className={`transition-colors ${row.status_id<10 ? 'cursor-not-allowed bg-gray-50/50' : 'hover:bg-gray-50 cursor-pointer'} ${selectedIds.includes(row.status_id) ? 'bg-indigo-50/50' : ''}`}>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}>{row.status_id >= 10 && <input type="checkbox" checked={selectedIds.includes(row.status_id)} onChange={() => toggleSelect(row.status_id)} className="w-4 h-4 rounded text-indigo-600" />}</td>
                  <td className="p-3 text-sm font-bold text-gray-700 flex items-center gap-1.5">{row.status_id < 10 && <Lock className="w-3 h-3 text-red-400" />} {row.status_id}</td>
                  <td className="p-3"><span className="text-[10px] font-bold border px-2 py-1 rounded">{row.domain_category}</span></td>
                  <td className="p-3 text-sm font-bold text-gray-900">{row.status_name}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{row.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                  <td className="p-3 text-xs font-medium text-gray-400">{row.ne_ts ? new Date(row.ne_ts).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {currentMeta && (
        <div className="p-4 mt-6 border border-gray-200 bg-white shadow-sm rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500 pl-2">총 {currentMeta.total_count} 건</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex gap-1">
              {getPageNumbers(page, currentMeta.total_pages).map(p => (
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold ${page === p ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-gray-600">
            <option value={10}>10개씩 보기</option><option value={20}>20개씩 보기</option><option value={50}>50개씩 보기</option>
          </select>
        </div>
      )}

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl w-[1200px] max-w-[95vw] h-[85vh] flex flex-col shadow-2xl overflow-hidden"><div className="p-6 border-b bg-blue-50/50 flex justify-between"><div><h2 className="text-xl font-extrabold flex items-center gap-2"><UploadCloud className="w-6 h-6 text-blue-600" /> 상태 일괄 주입</h2></div><button onClick={() => setIsPreviewOpen(false)}><X className="w-6 h-6"/></button></div><div className="flex-1 overflow-auto p-6 bg-gray-50/50">{previewErrors > 0 && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-bold"><AlertCircle className="w-5 h-5 inline" /> 불량 레코드가 {previewErrors}건 존재합니다.</div>}<table className="w-full text-left bg-white text-sm"><thead className="bg-gray-100 text-gray-500"><tr><th className="p-3">Row</th><th className="p-3">ID</th><th className="p-3">Category</th><th className="p-3">Name</th></tr></thead><tbody>{previewData.map((row, i) => <tr key={i} className={row.hasError ? 'bg-red-50/50' : 'hover:bg-gray-50'}><td className="p-3">{row.index}</td><td className="p-3">{row.id || '누락'}</td><td className="p-3">{row.type || '누락'}</td><td className="p-3">{row.name || '누락'}</td></tr>)}</tbody></table></div><div className="p-6 border-t flex justify-end gap-3"><button onClick={() => setIsPreviewOpen(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg font-semibold">취소</button><button onClick={() => previewErrors === 0 && bulkUpsertMut.mutate(previewData.map(item => ({ status_id: item.id, domain_category: item.type.toUpperCase(), status_name: item.name, is_active: item.is_active })))} disabled={previewErrors > 0 || bulkUpsertMut.isPending} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold"><Database className="w-5 h-5 inline"/> 최종 주입 확정</button></div></div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-[600px] max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-6 border-b pb-4"><h2 className="text-2xl font-extrabold">{selectedId ? '상태 마스터 수정' : '상태 등록'}</h2><button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6"/></button></div><div className="space-y-6"><div className="grid grid-cols-2 gap-6"><div><label className="block text-sm font-bold mb-1">ID *</label><input type="number" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={selectedId !== null} className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" /></div><div><label className="block text-sm font-bold mb-1">카테고리 *</label><select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-bold"><option value="ENTITY">ENTITY</option><option value="OBJECT">OBJECT</option><option value="TRANSACTION">TRANSACTION</option><option value="WORKFLOW">WORKFLOW</option></select></div></div><div><label className="block text-sm font-bold mb-1">상태 표시명 *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-base font-bold" /></div><div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border"><input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 cursor-pointer" /><label className="text-sm font-bold cursor-pointer">이 상태 코드를 활성화하여 콤보박스에 표시합니다.</label></div></div>{selectedId && <div className="mt-6 flex justify-between bg-gray-50 p-4 rounded-xl border"><span className="text-xs text-gray-400 font-medium">최초 생성: {formData.ne_ts ? new Date(formData.ne_ts).toLocaleString('ko-KR') : '-'}</span>{selectedId >= 10 && <button onClick={() => confirm("삭제하시겠습니까?") && deleteMut.mutate(selectedId)} disabled={deleteMut.isPending} className="text-xs font-bold text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3"/> 논리 삭제</button>}</div>}<div className="mt-6 pt-4 border-t flex justify-end gap-3"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg font-semibold">취소</button><button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold"><Save className="w-4 h-4"/> 저장</button></div></div>
        </div>
      )}
    </>
  );
}