'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Papa from 'papaparse';
import { Search, Plus, Trash2, Download, UploadCloud, XCircle, ChevronLeft, ChevronRight, RefreshCw, X, AlertCircle, Database, Save } from 'lucide-react';
import { getEntities, createEntity, updateEntity, deleteBulkEntities, getEntityTypes, bulkUpsertEntities, getStatusOptions } from '@/lib/api/master';

type SearchCondition = { id: number; target: string; keyword: string; operator: 'AND' | 'OR'; };

// 💡 [결함 수정] Pagination Windowing Helper 적용
const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function EntityView() {
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

  const [formData, setFormData] = useState({ id: '' as string | number, name: '', type: '', parent_id: '' as string | number, status_id: 1, aliases: '', attributes: [] as {key: string, value: string}[], ne_ts: '', up_ts: '' });

  const { data: entityTypesData } = useQuery({ queryKey: ['entityTypes'], queryFn: getEntityTypes });
  const { data: statusOptionsData } = useQuery({ queryKey: ['statusOptions', 'ENTITY'], queryFn: () => getStatusOptions('ENTITY') });
  const { data: entitiesData, isLoading } = useQuery({ queryKey: ['entities', page, limit, typeFilter, appliedConditions], queryFn: () => getEntities(page, limit, typeFilter, appliedConditions) });

  const handleSuccess = (msg: string) => { alert(msg); setIsModalOpen(false); setIsPreviewOpen(false); queryClient.invalidateQueries({ queryKey: ['entities'] }); queryClient.invalidateQueries({ queryKey: ['entityTypes'] }); };
  const handleError = (err: any) => alert(err.response?.data?.detail || "오류 발생");

  const createMut = useMutation({ mutationFn: createEntity, onSuccess: () => handleSuccess("저장 성공"), onError: handleError });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number, data: any }) => updateEntity(id, data), onSuccess: () => handleSuccess("수정 성공"), onError: handleError });
  const bulkDeleteMut = useMutation({ mutationFn: deleteBulkEntities, onSuccess: () => { handleSuccess("일괄 삭제 성공"); setSelectedIds([]); }, onError: handleError });
  const bulkUpsertMut = useMutation({ mutationFn: bulkUpsertEntities, onSuccess: () => handleSuccess("일괄 주입 성공"), onError: handleError });

  const currentFilterTypes = entityTypesData?.data || [];
  const currentMeta = entitiesData?.meta;
  const currentDataList = entitiesData?.data || [];

  const toggleSelectAll = () => setSelectedIds(selectedIds.length === currentDataList.length && currentDataList.length > 0 ? [] : currentDataList.map((i: any) => i.entity_id));
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    const selectedData = currentDataList.filter((item: any) => selectedIds.includes(item.entity_id));
    const allAttrKeys = new Set<string>();
    selectedData.forEach((item: any) => { if (item.attributes) Object.keys(item.attributes).forEach(k => allAttrKeys.add(k)); });
    const flatData = selectedData.map((item: any) => {
      const baseObj: any = { ID: item.entity_id, TYPE: item.entity_type, NAME: item.entity_name, PARENT: item.parent_entity_id || '', CREATED_AT: item.ne_ts || '', UPDATED_AT: item.up_ts || '' };
      allAttrKeys.forEach(key => { baseObj[key] = (item.attributes && item.attributes[key]) ? item.attributes[key] : ''; });
      return baseObj;
    });
    const blob = new Blob(["\uFEFF" + Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `defacto_entity_export.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        let errCount = 0;
        const parsed = results.data.map((row: any, index: number) => {
          const type = row.TYPE?.trim(); const name = row.NAME?.trim(); if (!type || !name) errCount++;
          const attrs: any = {}; Object.keys(row).forEach(key => { const upper = key.trim().toUpperCase(); if (!['ID','TYPE','NAME','PARENT','CREATED_AT','UPDATED_AT'].includes(upper) && row[key]) attrs[key.trim()] = row[key].trim(); });
          return { index: index + 1, id: row.ID ? Number(row.ID) : null, type, name, parent_id: row.PARENT ? Number(row.PARENT) : null, attributes: attrs, hasError: !type || !name };
        });
        setPreviewData(parsed); setPreviewErrors(errCount); setIsPreviewOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.type.trim()) return alert("이름과 타입은 필수입니다.");
    const finalAttributes: Record<string, any> = {};
    formData.attributes.forEach(a => { if (a.key.trim()) finalAttributes[a.key.trim()] = a.value; });
    const aliasList = formData.aliases.split(',').map(s => s.trim()).filter(Boolean);
    if (aliasList.length > 0) finalAttributes['aliases'] = aliasList;
    
    const payload = { entity_id: formData.id ? Number(formData.id) : null, entity_name: formData.name, entity_type: formData.type.toUpperCase(), parent_entity_id: formData.parent_id ? Number(formData.parent_id) : null, entity_status_id: formData.status_id, attributes: finalAttributes };
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
                <option value="ALL">모든 타입 보기</option>{currentFilterTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(typeFilter !== 'ALL' || appliedConditions.length > 0) && <div className="pt-7"><button onClick={() => { setTypeFilter('ALL'); setConditions([{ id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }]); setAppliedConditions([]); }} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm"><XCircle className="w-4 h-4 inline" /> 초기화</button></div>}
          </div>
          <div className="flex items-center gap-3 mt-7">
            {selectedIds.length === 0 ? (
              <><input type="file" ref={fileInputRef} accept=".csv, .tsv" onChange={handleFileUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold"><UploadCloud className="w-4 h-4 inline" /> 주입</button><button onClick={() => { setSelectedId(null); setFormData({ id: '', name: '', type: '', parent_id: '', status_id: 1, aliases: '', attributes: [], ne_ts: '', up_ts: '' }); setIsModalOpen(true); }} className="bg-emerald-600 text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold"><Plus className="w-4 h-4 inline" /> 등록</button></>
            ) : (
              <><button onClick={handleExport} className="bg-purple-600 text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold"><Download className="w-4 h-4 inline" /> 추출 ({selectedIds.length})</button><button onClick={() => confirm("일괄 삭제하시겠습니까?") && bulkDeleteMut.mutate(selectedIds)} disabled={bulkDeleteMut.isPending} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold"><Trash2 className="w-4 h-4 inline" /> 삭제 ({selectedIds.length})</button></>
            )}
          </div>
        </div>
        
        {/* 다중 검색 UI */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <label className="block text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-emerald-600"/> 다중 조건 상세 검색</label>
          <div className="flex flex-col gap-3">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                {idx > 0 ? <select value={cond.operator} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as 'AND'|'OR' } : c))} className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 w-20 text-center"><option value="AND">AND</option><option value="OR">OR</option></select> : <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">WHERE</span>}
                <select value={cond.target} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, target: e.target.value } : c))} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-40"><option value="NAME">Name</option><option value="ID">ID</option><option value="TYPE">Type</option><option value="PARENT">Parent</option><option value="ATTRIBUTES">Attributes</option></select>
                <input type="text" value={cond.keyword} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, keyword: e.target.value } : c))} onKeyDown={(e) => e.key === 'Enter' && setAppliedConditions([...conditions])} className="px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md w-[27rem] font-medium" />
                {conditions.length > 1 && <button onClick={() => setConditions(conditions.filter(c => c.id !== cond.id))} className="text-gray-400 hover:text-red-500 p-1.5"><X className="w-4 h-4" /></button>}
                {idx === conditions.length - 1 && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }])} className="text-xs font-bold text-gray-600 bg-white border px-3 py-1.5 rounded-md"><Plus className="w-3 h-3 inline" /> AND</button>
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'NAME', keyword: '', operator: 'OR' }])} className="text-xs font-bold text-gray-600 bg-white border px-3 py-1.5 rounded-md"><Plus className="w-3 h-3 inline" /> OR</button>
                    <button onClick={() => setAppliedConditions([...conditions])} className="bg-emerald-600 text-white px-4 py-1.5 rounded-md text-sm font-bold"><Search className="w-4 h-4 inline" /> 검색</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
        {isLoading ? <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div> : currentDataList.length === 0 ? <p className="text-center text-gray-400 font-bold py-20">데이터가 없습니다.</p> : (
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-3 w-12 text-center"><input type="checkbox" checked={selectedIds.length === currentDataList.length && currentDataList.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded text-emerald-600" /></th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">ID</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Type</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Name</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Parent</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Status ID</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase">Attributes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentDataList.map((row: any) => (
                <tr key={row.entity_id} onClick={() => toggleSelect(row.entity_id)} onDoubleClick={() => {
                  const aliases = Array.isArray(row.attributes?.aliases) ? row.attributes.aliases.join(', ') : '';
                  const attrs = Object.entries(row.attributes || {}).filter(([k]) => k !== 'aliases').map(([k, v]) => ({ key: k, value: String(v) }));
                  setSelectedId(row.entity_id); setFormData({ id: row.entity_id, name: row.entity_name, type: row.entity_type, parent_id: row.parent_entity_id || '', status_id: row.entity_status_id || 1, aliases, attributes: attrs, ne_ts: row.ne_ts, up_ts: row.up_ts });
                  setIsModalOpen(true);
                }} className={`hover:bg-gray-50 cursor-pointer ${selectedIds.includes(row.entity_id) ? 'bg-emerald-50/50' : ''}`}>
                  <td className="p-3 text-center" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(row.entity_id)} onChange={() => toggleSelect(row.entity_id)} className="w-4 h-4 rounded text-emerald-600" /></td>
                  <td className="p-3 text-sm font-bold text-gray-700">{row.entity_id}</td>
                  <td className="p-3"><span className="text-[10px] font-bold border px-2 py-1 rounded">{row.entity_type}</span></td>
                  <td className="p-3 text-sm font-bold text-gray-900">{row.entity_name}</td>
                  <td className="p-3 text-sm font-medium text-gray-500">{row.parent_entity_id || '-'}</td>
                  <td className="p-3 text-sm font-bold text-gray-600 text-center">{row.entity_status_id}</td>
                  <td className="p-3 text-xs font-mono text-gray-500 truncate max-w-[200px]">{!row.attributes || Object.keys(row.attributes).length===0 ? '-' : Object.entries(row.attributes).map(([k,v])=>`${k}:${v}`).join(' | ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {currentMeta && (
        <div className="p-4 mt-6 border border-gray-200 bg-white shadow-sm rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500">총 {currentMeta.total_count} 건</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex gap-1">{getPageNumbers(page, currentMeta.total_pages).map(p => <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold ${page === p ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100'}`}>{p}</button>)}</div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border rounded-lg px-2 py-1.5 outline-none font-bold text-sm"><option value={10}>10개</option><option value={20}>20개</option><option value={50}>50개</option></select>
        </div>
      )}

      {/* 미리보기 모달 */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl w-[1200px] h-[85vh] flex flex-col overflow-hidden"><div className="p-6 border-b bg-blue-50/50 flex justify-between"><div><h2 className="text-xl font-extrabold flex items-center gap-2"><UploadCloud className="w-6 h-6 text-blue-600" /> 주체(Entity) 일괄 주입</h2></div><button onClick={() => setIsPreviewOpen(false)}><X className="w-6 h-6"/></button></div><div className="flex-1 overflow-auto p-6 bg-gray-50/50">{previewErrors > 0 && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-bold"><AlertCircle className="w-5 h-5 inline" /> 불량 레코드가 {previewErrors}건 존재합니다.</div>}<table className="w-full text-left bg-white text-sm"><thead className="bg-gray-100 text-gray-500"><tr><th className="p-3">Row</th><th className="p-3">ID</th><th className="p-3">Type</th><th className="p-3">Name</th><th className="p-3">Parent</th></tr></thead><tbody>{previewData.map((row, i) => <tr key={i} className={row.hasError ? 'bg-red-50/50' : 'hover:bg-gray-50'}><td className="p-3">{row.index}</td><td className="p-3">{row.id || '자동'}</td><td className="p-3">{row.type || '누락'}</td><td className="p-3">{row.name || '누락'}</td><td className="p-3">{row.parent_id || '-'}</td></tr>)}</tbody></table></div><div className="p-6 border-t flex justify-end gap-3"><button onClick={() => setIsPreviewOpen(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg font-semibold">취소</button><button onClick={() => previewErrors === 0 && bulkUpsertMut.mutate(previewData.map(item => ({ entity_id: item.id, entity_type: item.type.toUpperCase(), entity_name: item.name, parent_entity_id: item.parent_id, attributes: item.attributes })))} disabled={previewErrors > 0 || bulkUpsertMut.isPending} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold"><Database className="w-5 h-5 inline"/> 최종 주입 확정</button></div></div>
        </div>
      )}

      {/* 등록/편집 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-[600px] max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-6 border-b pb-4"><h2 className="text-2xl font-extrabold">{selectedId ? '주체 마스터 수정' : '주체 등록'}</h2><button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6"/></button></div><div className="space-y-6"><div className="grid grid-cols-3 gap-6"><div><label className="block text-sm font-bold mb-1">ID</label><input type="number" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} placeholder="자동발급" className="w-full border rounded-lg px-3 py-2 text-sm" /></div><div><label className="block text-sm font-bold mb-1">타입 *</label><input type="text" list="type-options" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value.toUpperCase()})} className="w-full border rounded-lg px-3 py-2 text-sm uppercase" /><datalist id="type-options">{currentFilterTypes.map((t: string) => <option key={t} value={t} />)}</datalist></div><div><label className="block text-sm font-bold mb-1">상위 ID</label><input type="number" value={formData.parent_id} onChange={e => setFormData({...formData, parent_id: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div></div><div><label className="block text-sm font-bold mb-1">이름 *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-base font-bold" /></div><div className="bg-emerald-50/50 p-4 rounded-xl"><label className="block text-sm font-bold mb-2">상태 ID</label><select value={formData.status_id} onChange={e => setFormData({...formData, status_id: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm">{statusOptionsData?.data?.map((s:any) => <option key={s.status_id} value={s.status_id}>{s.status_id} - {s.status_name}</option>)}{!statusOptionsData?.data?.some((s:any)=>s.status_id===1) && <option value={1}>1 - SYNCED</option>}</select></div><div><label className="block text-sm font-bold mb-1">검색 별칭 (콤마 구분)</label><input type="text" value={formData.aliases} onChange={e => setFormData({...formData, aliases: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" /></div><div className="border rounded-xl p-5"><div className="flex justify-between mb-4"><h3 className="text-sm font-extrabold">속성 (JSONB)</h3><button onClick={() => setFormData({...formData, attributes: [...formData.attributes, {key:'', value:''}]})} className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">추가</button></div><div className="space-y-3">{formData.attributes.map((attr, idx) => <div key={idx} className="flex gap-2"><input type="text" value={attr.key} onChange={e => { const n = [...formData.attributes]; n[idx].key = e.target.value; setFormData({...formData, attributes: n}); }} className="w-1/3 border rounded px-2" placeholder="Key"/><input type="text" value={attr.value} onChange={e => { const n = [...formData.attributes]; n[idx].value = e.target.value; setFormData({...formData, attributes: n}); }} className="flex-1 border rounded px-2" placeholder="Value"/><button onClick={() => setFormData({...formData, attributes: formData.attributes.filter((_, i) => i !== idx)})} className="p-1"><X className="w-4 h-4"/></button></div>)}</div></div></div><div className="mt-6 pt-4 border-t flex justify-end gap-3"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 rounded-lg font-semibold">취소</button><button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold"><Save className="w-4 h-4"/> 저장</button></div></div>
        </div>
      )}
    </>
  );
}