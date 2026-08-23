'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { RefreshCw, Trash2, Database, ChevronLeft, ChevronRight, Wand2, Type, AlertTriangle, Calendar, XCircle, LayoutGrid, List as ListIcon, Search, X, Plus, Sparkles, Download } from 'lucide-react';
import { getEventCreations, deleteEventCreation } from '@/lib/api/pipeline';
import { EventCreationItem } from '@/types/api';

type SearchCondition = { id: number; target: string; keyword: string; operator: 'AND' | 'OR'; };

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function CreativeArchiveView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: 'TITLE', keyword: '', operator: 'AND' }]);
  const [appliedConditions, setAppliedConditions] = useState<SearchCondition[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('CARD');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const { data: creationsData, isLoading, isError } = useQuery({
    queryKey: ['eventCreations', page, limit, startDate, endDate, appliedConditions],
    queryFn: () => getEventCreations(page, limit, undefined, startDate, endDate, appliedConditions),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => await deleteEventCreation(id),
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['eventCreations'] });
      setSelectedIds([]);
    },
    onError: (err: any) => alert(err.response?.data?.detail || "삭제에 실패했습니다.")
  });

  const resetFilters = () => { setStartDate(''); setEndDate(''); setConditions([{ id: Date.now(), target: 'TITLE', keyword: '', operator: 'AND' }]); setAppliedConditions([]); setPage(1); };
  const toggleSelectAll = () => { if (creationsData?.data) { setSelectedIds(selectedIds.length === creationsData.data.length && creationsData.data.length > 0 ? [] : creationsData.data.map((item: any) => item.creation_id)); } };
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    const flatData = (creationsData?.data?.filter((i: any) => selectedIds.includes(i.creation_id)) || []).map((item: any) => ({ 
      CREATION_ID: item.creation_id, 
      SOURCES: item.sources?.map((s: any) => `${s.source_type} #${s.source_id}`).join(', ') || '',
      ENTITY_ID: item.base_entity_id, 
      TONE_NAME: item.tone_name,
      TITLE: item.creative_title, 
      CONTENT: item.creative_content,
      DATE: item.ne_ts
    }));
    const blob = new Blob(["\uFEFF" + Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `defacto_creations_export.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleGoToStudio = () => {
    if (selectedIds.length === 0) return;
    const selectedData = creationsData?.data?.filter((i: any) => selectedIds.includes(i.creation_id)) || [];
    const sourcesQuery = selectedData.map((item: any) => `CREATION:${item.creation_id}:${item.base_entity_id}`).join(',');
    router.push(`/studio?sources=${sourcesQuery}`);
  };

  const formatDateStr = (ds: string) => ds ? new Date(ds).toLocaleDateString('ko-KR') : '-';
  const currentMeta = creationsData?.meta;

  if (isError) {
    return (
      <div className="py-20 text-center bg-white rounded-2xl border border-red-200 shadow-sm flex flex-col items-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-red-600 font-extrabold text-lg mb-1">데이터베이스 연결 오류 (500 Internal Server Error)</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in zoom-in duration-300">
      
      {/* 검색 및 필터 UI */}
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
              <button onClick={() => setViewMode('CARD')} className={`p-1.5 rounded-md ${viewMode === 'CARD' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}><LayoutGrid size={18}/></button>
              <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded-md ${viewMode === 'LIST' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-400'}`}><ListIcon size={18}/></button>
            </div>
            
            {selectedIds.length > 0 && (
              <>
                <button onClick={handleExport} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm"><Download className="w-4 h-4" /> 추출 ({selectedIds.length})</button>
                <button onClick={handleGoToStudio} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-md"><Sparkles className="w-4 h-4" /> 창작 ({selectedIds.length})</button>
              </>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <label className="block text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-purple-600"/> 다중 조건 검색</label>
          <div className="flex flex-col gap-3">
            {conditions.map((cond, idx) => (
              <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                {idx > 0 ? <select value={cond.operator} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as 'AND' | 'OR' } : c))} className="text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5 w-20 text-center shadow-sm"><option value="AND">AND</option><option value="OR">OR</option></select> : <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">WHERE</span>}
                <select value={cond.target} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, target: e.target.value } : c))} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-40 shadow-sm"><option value="TITLE">Title</option><option value="CONTENT">Content</option><option value="TONE_NAME">Tone Name</option><option value="ENTITY_ID">Entity ID</option><option value="CREATION_ID">Creation ID</option></select>
                <input type="text" value={cond.keyword} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, keyword: e.target.value } : c))} onKeyDown={(e) => e.key === 'Enter' && setAppliedConditions([...conditions])} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-purple-400" />
                {conditions.length > 1 && <button onClick={() => setConditions(conditions.filter(c => c.id !== cond.id))} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded"><X className="w-4 h-4" /></button>}
                {idx === conditions.length - 1 && (
                  <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'TITLE', keyword: '', operator: 'AND' }])} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> AND</button>
                    <button onClick={() => setConditions([...conditions, { id: Date.now(), target: 'TITLE', keyword: '', operator: 'OR' }])} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> OR</button>
                    <button onClick={() => setAppliedConditions([...conditions])} className="bg-purple-600 text-white px-4 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 shadow-sm ml-1"><Search className="w-4 h-4" /> 검색 적용</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? <div className="py-20 text-center text-gray-400 font-bold flex flex-col items-center"><RefreshCw className="w-8 h-8 animate-spin mb-3 text-purple-300" /> 불러오는 중...</div> :
       creationsData?.data?.length === 0 || !creationsData?.data ? <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300"><Wand2 className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500 font-bold">조건에 일치하는 창작물이 없습니다.</p></div> :
       viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {creationsData?.data?.map((creation: EventCreationItem) => {
            const isSelected = selectedIds.includes(creation.creation_id);
            return (
              <div key={creation.creation_id} onClick={() => toggleSelect(creation.creation_id)} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all cursor-pointer ${isSelected ? 'border-purple-500 ring-1 ring-purple-500 bg-purple-50/20' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="bg-gray-50 border-b border-gray-200 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(creation.creation_id)} className="w-4 h-4 text-purple-600 rounded cursor-pointer" onClick={e => e.stopPropagation()}/>
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1"><Type className="w-3.5 h-3.5"/> 톤앤매너: {creation.tone_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); if(confirm("정말 영구 삭제하시겠습니까?")) deleteMut.mutate(creation.creation_id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  {/* 💡 [수정 완료] 증발된 onClick 이벤트와 UI 복원 */}
                  <div className="flex flex-wrap items-center gap-1.5 pl-1">
                    {creation.sources?.map((src: any, idx: number) => (
                       <div key={idx} className="flex items-center gap-1.5 cursor-pointer bg-white border border-gray-300 hover:border-blue-400 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors group" onClick={(e) => { e.stopPropagation(); alert(`해당 탭(${src.source_type})으로 이동하여 원본 데이터를 식별(ID: ${src.source_id})하는 기능은 추후 라우터 확장이 필요합니다. 원본의 식별 무결성이 보장됩니다.`); }} title="클릭하여 원본 소스로 추적하기">
                         <Database className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500"/>
                         <span className="text-[10px] font-extrabold text-gray-500 group-hover:text-blue-600">Source: {src.source_type} #{src.source_id}</span>
                       </div>
                    ))}
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-4">
                  <h3 className="text-lg font-extrabold text-gray-900">{creation.creative_title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100 font-medium line-clamp-6">{creation.creative_content}</p>
                  <div className="mt-auto pt-2 text-right"><span className="text-[10px] font-medium text-gray-400">생성일: {formatDateStr(creation.ne_ts)}</span></div>
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
                <th className="p-3 w-12 text-center"><input type="checkbox" checked={selectedIds.length === (creationsData?.data?.length || 0) && (creationsData?.data?.length || 0) > 0} onChange={toggleSelectAll} className="w-4 h-4 text-purple-600 rounded cursor-pointer" /></th>
                <th className="p-3 w-24 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Creation ID</th>
                <th className="p-3 w-40 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Source(s)</th>
                <th className="p-3 w-28 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Tone</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider min-w-[200px]">Title</th>
                <th className="p-3 w-32 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {creationsData?.data?.map((creation: any) => {
                const isSelected = selectedIds.includes(creation.creation_id);
                return (
                  <tr key={creation.creation_id} onClick={() => toggleSelect(creation.creation_id)} className={`transition-colors cursor-pointer ${isSelected ? 'bg-purple-50/50' : 'hover:bg-gray-50'}`}>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(creation.creation_id)} className="w-4 h-4 text-purple-600 rounded cursor-pointer" /></td>
                    <td className="p-3 text-sm font-bold text-gray-700">{creation.creation_id}</td>
                    
                    {/* 💡 [치명적 결함 해결] List 뷰 다중 소스 렌더링 정상화 */}
                    <td className="p-3 text-xs font-bold text-gray-500">
                      {creation.sources?.map((s: any) => `${s.source_type} #${s.source_id}`).join(', ')}
                    </td>
                    
                    <td className="p-3"><span className="text-[10px] font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded">{creation.tone_name}</span></td>
                    <td className="p-3 text-sm font-bold text-gray-900 truncate max-w-[300px]">{creation.creative_title}</td>
                    <td className="p-3 text-center"><span className="text-[10px] font-bold text-gray-400">{formatDateStr(creation.ne_ts)}</span></td>
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
                <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
            </div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold text-gray-600 cursor-pointer shadow-sm">
            <option value={10}>10개씩 보기</option>
            <option value={20}>20개씩 보기</option>
            <option value={50}>50개씩 보기</option>
          </select>
        </div>
      )}
    </div>
  );
}