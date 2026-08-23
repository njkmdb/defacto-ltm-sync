'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { RefreshCw, FileText, User, SearchCode, Search, CheckSquare, AlertTriangle, Lightbulb, X, Database, ChevronLeft, ChevronRight, Sparkles, Calendar, XCircle, Plus, LayoutGrid, List as ListIcon, Trash2, Save, Download } from 'lucide-react';
import { getEventBriefings, getBriefingAuditTrail, updateEventBriefing, deleteBulkEventBriefings } from '@/lib/api/pipeline';

type SearchCondition = { id: number; target: string; keyword: string; operator: 'AND' | 'OR'; };

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function BriefingArchiveView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: 'SUMMARY', keyword: '', operator: 'AND' }]);
  const [appliedConditions, setAppliedConditions] = useState<SearchCondition[]>([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState<'CARD' | 'LIST'>('LIST');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
  const [isBriefingViewerOpen, setIsBriefingViewerOpen] = useState(false);
  
  // 💡 모달 내 책갈피 탭 상태 추가
  const [activeModalTab, setActiveModalTab] = useState<'EDIT' | 'AUDIT'>('EDIT');
  const [editFormData, setEditFormData] = useState({ query_text: '', executive_summary: '', key_findings: '', risk_and_warnings: '', recommended_actions: '' });

  const { data: briefingsData, isLoading } = useQuery({
    queryKey: ['eventBriefings', page, limit, startDate, endDate, appliedConditions],
    queryFn: () => getEventBriefings(page, limit, undefined, startDate, endDate, appliedConditions),
  });

  // 💡 모달이 열려있고 선택된 리포트가 있을 때만 감사 추적 데이터 로드
  const { data: auditData, isLoading: isAuditLoading } = useQuery({
    queryKey: ['auditTrail', selectedBriefing?.briefing_id],
    queryFn: () => getBriefingAuditTrail(selectedBriefing?.briefing_id),
    enabled: isBriefingViewerOpen && !!selectedBriefing
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => await updateEventBriefing(id, data),
    onSuccess: () => {
      alert("요약 리포트가 성공적으로 수정되었습니다.");
      setIsBriefingViewerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['eventBriefings'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "수정에 실패했습니다.")
  });

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: number[]) => await deleteBulkEventBriefings(ids),
    onSuccess: (data) => {
      alert(data.message);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['eventBriefings'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "일괄 삭제에 실패했습니다.")
  });

  const formatDateStr = (ds: string) => ds ? new Date(ds).toLocaleDateString('ko-KR') : '-';
  const currentMeta = briefingsData?.meta;

  const resetFilters = () => { setStartDate(''); setEndDate(''); setConditions([{ id: Date.now(), target: 'SUMMARY', keyword: '', operator: 'AND' }]); setAppliedConditions([]); setPage(1); };

  const toggleSelectAll = () => {
    if (briefingsData?.data) {
      setSelectedIds(selectedIds.length === briefingsData.data.length && briefingsData.data.length > 0 ? [] : briefingsData.data.map((b: any) => b.briefing_id));
    }
  };
  
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleGoToStudio = () => {
    if (selectedIds.length === 0) return;
    const selectedData = briefingsData?.data?.filter((i: any) => selectedIds.includes(i.briefing_id)) || [];
    const sourcesQuery = selectedData.map((item: any) => `BRIEFING:${item.briefing_id}:${item.base_entity_id}`).join(',');
    router.push(`/studio?sources=${sourcesQuery}`);
  };

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    const flatData = (briefingsData?.data?.filter((i: any) => selectedIds.includes(i.briefing_id)) || []).map((b: any) => ({
      BRIEFING_ID: b.briefing_id, ENTITY_ID: b.base_entity_id, DATE: b.ne_ts, QUERY: b.query_text, SUMMARY: b.executive_summary
    }));
    const blob = new Blob(["\uFEFF" + Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `defacto_briefings_export.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // 💡 열람 시 활성 탭 초기화 로직 추가
  const openEditModal = (briefing: any) => {
    setSelectedBriefing(briefing);
    setActiveModalTab('EDIT');
    setEditFormData({
      query_text: briefing.query_text || '',
      executive_summary: briefing.executive_summary || '',
      key_findings: briefing.key_findings ? briefing.key_findings.join('\n- ') : '',
      risk_and_warnings: briefing.risk_and_warnings ? briefing.risk_and_warnings.join('\n- ') : '',
      recommended_actions: briefing.recommended_actions ? briefing.recommended_actions.join('\n- ') : ''
    });
    setIsBriefingViewerOpen(true);
  };

  const handleEditSubmit = () => {
    if (!editFormData.executive_summary.trim() || !editFormData.query_text.trim()) return alert("질의와 총평은 필수 입력입니다.");
    updateMut.mutate({
      id: selectedBriefing.briefing_id,
      data: {
        query_text: editFormData.query_text,
        executive_summary: editFormData.executive_summary,
        key_findings: editFormData.key_findings.split('\n- ').filter(Boolean),
        risk_and_warnings: editFormData.risk_and_warnings.split('\n- ').filter(Boolean),
        recommended_actions: editFormData.recommended_actions.split('\n- ').filter(Boolean)
      }
    });
  };

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400 font-bold flex flex-col items-center"><RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-300" /> 요약 리포트 아카이브를 불러오는 중입니다...</div>;
  }

  return (
    <div className="animate-in fade-in zoom-in duration-300">
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
            {selectedIds.length > 0 && (
              <>
                <button onClick={handleExport} className="flex items-center gap-1.5 bg-gray-800 text-white hover:bg-black transition-colors px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm"><Download className="w-4 h-4" /> 추출 ({selectedIds.length})</button>
                <button onClick={handleGoToStudio} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-md h-10"><Sparkles className="w-4 h-4" /> 창작 ({selectedIds.length})</button>
                <button onClick={() => { if(confirm("일괄 삭제하시겠습니까?")) bulkDeleteMut.mutate(selectedIds); }} disabled={bulkDeleteMut.isPending} className="flex items-center gap-1 text-sm bg-red-50 hover:bg-red-100 transition-colors text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold disabled:opacity-50"><Trash2 className="w-4 h-4" /> 삭제 ({selectedIds.length})</button>
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
                <select value={cond.target} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, target: e.target.value } : c))} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-40 shadow-sm">
                  <option value="SUMMARY">Summary (요약문)</option>
                  <option value="QUERY">Query Text (질의)</option>
                  <option value="ENTITY_ID">Entity ID</option>
                  <option value="BRIEFING_ID">Briefing ID</option>
                </select>
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

      {viewMode === 'CARD' && (
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:bg-gray-50 transition-colors">
            <input type="checkbox" checked={selectedIds.length === (briefingsData?.data?.length || 0) && selectedIds.length > 0} onChange={toggleSelectAll} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
            현재 페이지 전체 선택
          </label>
        </div>
      )}

      {briefingsData?.data?.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-bold">조건에 일치하는 요약 리포트가 없습니다.</p>
        </div>
      ) : viewMode === 'CARD' ? (
        <div className="grid grid-cols-1 gap-6">
          {briefingsData?.data?.map((briefing: any) => {
            const isSelected = selectedIds.includes(briefing.briefing_id);
            return (
              <div key={briefing.briefing_id} onClick={() => toggleSelect(briefing.briefing_id)} onDoubleClick={(e) => { e.stopPropagation(); openEditModal(briefing); }} className={`bg-white rounded-2xl shadow-sm border p-6 flex flex-col gap-4 transition-all cursor-pointer ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/20' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-4">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(briefing.briefing_id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" onClick={(e) => e.stopPropagation()} />
                    <span className="bg-gray-900 text-white px-3 py-1 rounded text-xs font-bold">Briefing ID: {briefing.briefing_id}</span>
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5"><User className="w-4 h-4"/> Target Entity: {briefing.base_entity_id}</span>
                    <span className="text-sm font-medium text-gray-400">생성일: {formatDateStr(briefing.ne_ts)}</span>
                  </div>
                  {/* 💡 개별 액션 버튼 영역 삭제됨 */}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Query Text (프롬프트 질의)</h4>
                  <p className="text-sm text-gray-800 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-100">{briefing.query_text}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-400 mb-2 uppercase">Executive Summary (요약)</h4>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{briefing.executive_summary}</p>
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
                <th className="p-3 w-12 text-center"><input type="checkbox" checked={selectedIds.length === (briefingsData?.data?.length || 0) && (briefingsData?.data?.length || 0) > 0} onChange={toggleSelectAll} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" /></th>
                <th className="p-3 w-24 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Briefing ID</th>
                <th className="p-3 w-24 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Entity ID</th>
                <th className="p-3 w-32 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="p-3 w-64 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Query Text</th>
                <th className="p-3 text-xs font-extrabold text-gray-500 uppercase tracking-wider min-w-[300px]">Executive Summary</th>
                {/* 💡 Actions 헤더 삭제됨 */}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {briefingsData?.data?.map((briefing: any) => {
                const isSelected = selectedIds.includes(briefing.briefing_id);
                return (
                  <tr key={briefing.briefing_id} onClick={() => toggleSelect(briefing.briefing_id)} onDoubleClick={(e) => { e.stopPropagation(); openEditModal(briefing); }} className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}`} title="더블클릭하여 상세 열람">
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(briefing.briefing_id)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" /></td>
                    <td className="p-3 text-sm font-bold text-gray-700">{briefing.briefing_id}</td>
                    <td className="p-3 text-sm font-bold text-gray-600">{briefing.base_entity_id}</td>
                    <td className="p-3"><span className="text-[10px] font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded">{formatDateStr(briefing.ne_ts)}</span></td>
                    <td className="p-3 text-sm text-gray-800 truncate max-w-[250px]">{briefing.query_text}</td>
                    <td className="p-3 text-sm text-gray-600 truncate max-w-[400px]">{briefing.executive_summary}</td>
                    {/* 💡 개별 액션 버튼 셀 삭제됨 */}
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

      {/* 💡 요약 리포트 열람 및 편집 모달 (책갈피 탭 통합) */}
      {isBriefingViewerOpen && selectedBriefing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-50 rounded-2xl w-[900px] max-w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-900 px-5 pt-5 pb-0 flex flex-col shrink-0 gap-4">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <h2 className="text-xl font-extrabold flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-400" /> 리포트 열람 및 교정</h2>
                  <p className="text-xs text-gray-400 mt-1">Briefing ID: {selectedBriefing.briefing_id} | Target Entity: {selectedBriefing.base_entity_id}</p>
                </div>
                {/* 💡 삭제 버튼은 제거됨 */}
                <button onClick={() => setIsBriefingViewerOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1.5"><X className="w-6 h-6" /></button>
              </div>
              
              {/* 💡 교정 / 감사 추적 책갈피 탭 */}
              <div className="flex gap-1">
                <button 
                  onClick={() => setActiveModalTab('EDIT')} 
                  className={`px-5 py-2.5 text-sm font-bold rounded-t-xl transition-colors ${activeModalTab === 'EDIT' ? 'bg-white text-indigo-700' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                  리포트 교정 내역
                </button>
                <button 
                  onClick={() => setActiveModalTab('AUDIT')} 
                  className={`px-5 py-2.5 text-sm font-bold rounded-t-xl transition-colors flex items-center gap-1.5 ${activeModalTab === 'AUDIT' ? 'bg-gray-100 text-emerald-700' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                >
                  <SearchCode className="w-4 h-4" /> 시스템 감사 추적 (Audit)
                </button>
              </div>
            </div>

            {activeModalTab === 'EDIT' ? (
              <>
                <div className="flex-1 overflow-y-auto p-8 bg-white space-y-6">
                  <div>
                    <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><Search className="w-4 h-4 text-blue-500"/> 프롬프트 질의 (Query Text)</label>
                    <textarea value={editFormData.query_text} onChange={e => setEditFormData({...editFormData, query_text: e.target.value})} className="w-full p-3 border border-blue-200 rounded-lg bg-blue-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 resize-none h-20" />
                  </div>
                  <div>
                    <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-indigo-500"/> 총평 (Executive Summary)</label>
                    <textarea value={editFormData.executive_summary} onChange={e => setEditFormData({...editFormData, executive_summary: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-400 resize-none h-32" />
                  </div>
                  <div>
                    <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-emerald-500"/> 주요 발견 팩트 (Key Findings, 띄어쓰기와 대시(-)로 줄바꿈)</label>
                    <textarea value={editFormData.key_findings} onChange={e => setEditFormData({...editFormData, key_findings: e.target.value})} className="w-full p-3 border border-emerald-200 rounded-lg bg-emerald-50/30 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-emerald-400 resize-none h-32" />
                  </div>
                  <div>
                    <label className="text-sm font-extrabold text-red-800 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> 위험 및 경고 (Risk & Warnings)</label>
                    <textarea value={editFormData.risk_and_warnings} onChange={e => setEditFormData({...editFormData, risk_and_warnings: e.target.value})} className="w-full p-3 border border-red-200 rounded-lg bg-red-50 text-sm font-medium outline-none focus:ring-2 focus:ring-red-400 resize-none h-24 text-red-800" />
                  </div>
                  <div>
                    <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-500"/> 행동 지침 (Recommended Actions)</label>
                    <textarea value={editFormData.recommended_actions} onChange={e => setEditFormData({...editFormData, recommended_actions: e.target.value})} className="w-full p-3 border border-amber-200 rounded-lg bg-amber-50/30 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-amber-400 resize-none h-24" />
                  </div>
                </div>
                <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
                  <button onClick={() => setIsBriefingViewerOpen(false)} className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors">닫기</button>
                  <button onClick={handleEditSubmit} disabled={updateMut.isPending} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-md transition-colors disabled:opacity-50">
                    {updateMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 수정 사항 저장
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 bg-gray-100 space-y-4">
                {isAuditLoading ? (
                  <div className="py-20 text-center text-gray-500 font-bold flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-400" /> DB에서 역추적 중입니다...
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 mb-2">
                      <Database className="w-6 h-6 text-gray-400" />
                      <p className="text-sm text-gray-600 font-bold">요약 리포트 생성 시 총 <strong className="text-emerald-600">{auditData?.data?.length || 0}</strong>개의 팩트 기억이 근거로 주입되었습니다.</p>
                    </div>
                    {auditData?.data?.map((mem: any) => (
                      <div key={mem.memory_id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                          <span className="bg-gray-800 text-white px-2 py-0.5 rounded text-[10px] font-extrabold">Mem ID: {mem.memory_id}</span>
                          <span className="text-xs font-bold text-gray-400">{mem.event_date}</span>
                          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded ml-auto">Source Facts: {mem.source_event_ids.join(', ')}</span>
                        </div>
                        <p className="text-sm text-gray-800 font-medium leading-relaxed">{mem.content_text}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}