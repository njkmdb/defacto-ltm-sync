'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrainCircuit, Search, Target, SlidersHorizontal, Hash, Calendar, Layers, Loader2, AlertCircle, Database, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { searchMemoryExplorer } from '@/lib/api/pipeline';
import { MemorySearchRequest, MemorySearchResultItem } from '@/types/api';
import MemorySearchConditions, { SearchCondition } from '@/components/memory/MemorySearchConditions';
import EventBriefingModal from '@/components/memory/EventBriefingModal';

export default function MemoryPage() {
  const queryClient = useQueryClient();
  
  // 💡 [보안 결함 수정] null 허용 상태를 제거하고 현재 테넌트 ID 고정 주입
  const baseEntityId = 1024;

  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(true);
  const [queryText, setQueryText] = useState<string>('');
  
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  const [distanceThreshold, setDistanceThreshold] = useState<number>(1.0);
  const [includeDwh, setIncludeDwh] = useState<boolean>(false);
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: 'CONTENT', keyword: '', operator: 'AND' }]);
  
  const [activeSearchParams, setActiveSearchParams] = useState<MemorySearchRequest | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);

  const { data: searchResponse, isLoading, isFetching } = useQuery({
    queryKey: ['memorySearch', activeSearchParams, page, limit],
    queryFn: async () => {
      if (!activeSearchParams) return null;
      const params = {
        ...activeSearchParams,
        page,
        limit
      };
      return await searchMemoryExplorer(params);
    },
    enabled: !!activeSearchParams,
  });

  const results = searchResponse?.data || [];
  const currentMeta = searchResponse?.meta;

  const handleSearch = () => {
    if (!queryText.trim()) return alert("검색어를 입력해주세요.");
    setPage(1);
    setSelectedIds([]);
    const validConds = conditions.filter(c => c.keyword.trim() !== '');
    
    setActiveSearchParams({
      query_text: queryText,
      distance_threshold: distanceThreshold,
      base_entity_id: baseEntityId, // 💡 전역 검색 방지를 위해 무조건 현재 테넌트 강제 전송
      search_conditions: validConds.length > 0 ? JSON.stringify(validConds) : null,
      include_dwh: includeDwh
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const toggleSelectAll = () => {
    if (results.length > 0 && selectedIds.length === results.length) {
      setSelectedIds([]);
    } else {
      // 💡 [타입 에러 수정] item 매개변수에 MemorySearchResultItem 타입 명시
      setSelectedIds(results.map((item: MemorySearchResultItem) => item.memory_id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getDistanceColor = (distance: number) => {
    if (distance <= 0.15) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (distance <= 0.3) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-32">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <BrainCircuit className="w-8 h-8 text-purple-600" /> 벡터 기억 탐색기 (Human-in-the-loop)
        </h1>
        <p className="text-sm text-gray-500 mt-2">다중 조건으로 과거 기억을 탐색하고, 체리피킹한 팩트들을 바탕으로 AI 요약 리포트를 생성합니다.</p>
      </header>

      {/* 🔍 검색 바 및 컨트롤 영역 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 bg-purple-50/30 border-b border-gray-100">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-6 h-6 text-purple-400" />
            <input 
              type="text" 
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="자연어로 과거 이력이나 팩트를 검색해보세요. (예: 저번에 알파팀이랑 단가 얼마에 협상했었지?)" 
              className="w-full pl-14 pr-32 py-4 bg-white border border-gray-300 rounded-xl text-lg outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 shadow-sm transition-all font-medium"
            />
            <button 
              onClick={handleSearch}
              disabled={isFetching}
              className="absolute right-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : "하이브리드 탐색"}
            </button>
          </div>
        </div>

        {/* 🎛️ 고급 필터 영역 */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)} 
            className="flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-purple-700 transition-colors mb-4"
          >
            <SlidersHorizontal className="w-4 h-4" /> 상세 필터 파라미터 제어
          </button>
          
          {isFilterOpen && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-white border border-gray-200 rounded-xl shadow-inner">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center justify-between">
                    <span>Distance Threshold</span>
                    <span className="text-[10px] text-gray-400 font-normal">(코사인 거리 한계선)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0.0" max="2.0" step="0.05"
                      value={distanceThreshold} 
                      onChange={(e) => setDistanceThreshold(parseFloat(e.target.value))}
                      className="flex-1 accent-purple-600"
                    />
                    <span className="w-12 text-center font-bold text-purple-700 bg-purple-50 py-1 rounded-md border border-purple-100">{distanceThreshold.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center justify-between">
                    <span>Base Entity ID (Tenant)</span>
                    <span className="text-[10px] text-emerald-500 font-bold">(보안 격리 활성화됨)</span>
                  </label>
                  <input 
                    type="text" 
                    value={baseEntityId} 
                    readOnly
                    className="w-full px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm font-bold text-gray-500 cursor-not-allowed"
                  />
                </div>
                
                <div className="flex flex-col justify-center">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Cloud Integration</label>
                  <label className="flex items-center gap-2 cursor-pointer bg-blue-50/50 p-2 rounded-lg border border-blue-100 hover:bg-blue-50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={includeDwh} 
                      onChange={(e) => setIncludeDwh(e.target.checked)} 
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-blue-800">Cloud DWH (BigQuery) 포함 검색</span>
                  </label>
                </div>
              </div>
              
              <MemorySearchConditions conditions={conditions} setConditions={setConditions} onSearch={handleSearch} />
            </div>
          )}
        </div>
      </div>

      {/* 📊 결과 렌더링 영역 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            {results.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors">
                <input type="checkbox" checked={selectedIds.length === results.length} onChange={toggleSelectAll} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer" />
                현재 페이지 전체 선택
              </label>
            )}
          </div>
          
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" /> 탐색 결과 
            <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{currentMeta?.total_count || 0} 건</span>
          </h3>
        </div>

        {results.length === 0 && !isFetching && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Target className="w-8 h-8 text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-600 mb-2">검색 결과가 없습니다</h2>
            <p className="text-sm text-gray-400">자연어 쿼리를 입력하고 시맨틱 검색 버튼을 눌러주세요.<br/>Threshold 값이나 다중 조건에 따라 결과가 다를 수 있습니다.</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* 💡 [타입 에러 수정] item 매개변수에 MemorySearchResultItem 타입 명시 */}
          {results.map((item: MemorySearchResultItem) => (
            <div 
              key={item.memory_id} 
              onClick={() => toggleSelect(item.memory_id)}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col cursor-pointer transition-all ${selectedIds.includes(item.memory_id) ? 'border-purple-400 ring-1 ring-purple-400' : 'border-gray-200 hover:border-purple-300'}`}
            >
              <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selectedIds.includes(item.memory_id)} onChange={() => toggleSelect(item.memory_id)} className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer" onClick={(e) => e.stopPropagation()}/>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${getDistanceColor(item.distance)}`} title="코사인 거리 (0에 가까울수록 의미가 일치함)">
                    Distance: {item.distance.toFixed(4)}
                  </span>
                  {item.distance <= 0.15 && (
                     <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                       <AlertCircle className="w-3 h-3" /> 강제구출 대상
                     </span>
                  )}
                </div>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded uppercase tracking-wider">
                  {item.memory_type}
                </span>
              </div>
              
              <div className="p-5 flex-1 flex flex-col gap-4">
                <div className="flex gap-4 text-xs font-bold text-gray-500">
                  <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5 text-purple-400"/> Mem ID: {item.memory_id}</span>
                  <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-blue-400"/> Base Entity: {item.base_entity_id}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-orange-400"/> {item.event_date}</span>
                </div>

                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 flex-1">
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-wrap">{item.content_text}</p>
                </div>
                
                <div className="flex flex-col gap-3 mt-auto pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold text-gray-400 w-16">KEYWORDS</span>
                    {item.core_keywords && item.core_keywords.length > 0 ? (
                      item.core_keywords.map((kw, i) => (
                        <span key={i} className="bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{kw}</span>
                      ))
                    ) : <span className="text-[10px] text-gray-400">-</span>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-extrabold text-gray-400 w-16">FACT IDs</span>
                    {item.source_event_ids && item.source_event_ids.length > 0 ? (
                      item.source_event_ids.map((id, i) => (
                        <span key={i} className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">#{id}</span>
                      ))
                    ) : <span className="text-[10px] text-gray-400">-</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* 페이징 UI */}
        {results.length > 0 && (
          <div className="mt-6 flex items-center justify-between border border-gray-200 bg-white shadow-sm p-4 rounded-xl">
            <span className="text-sm font-bold text-gray-500 pl-2">전체 {currentMeta?.total_pages || 1} 페이지</span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <div className="flex gap-1">
                {Array.from({ length: currentMeta?.total_pages || 1 }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
                ))}
              </div>
              <button disabled={page >= (currentMeta?.total_pages || 1)} onClick={() => setPage(p => p + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold text-gray-600">
              <option value={10}>10개씩 보기</option>
              <option value={20}>20개씩 보기</option>
              <option value={50}>50개씩 보기</option>
            </select>
          </div>
        )}
      </div>

      {/* 플로팅 액션 바 (리포트 생성 트리거) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8">
          <div className="bg-gray-900 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 border border-gray-700">
            <span className="text-white font-bold text-sm">
              <strong className="text-purple-400 text-lg">{selectedIds.length}</strong> 개의 핵심 기억이 선택되었습니다.
            </span>
            <button 
              onClick={() => setIsBriefingModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors"
            >
              <FileText className="w-4 h-4" /> AI 요약 리포트 생성
            </button>
          </div>
        </div>
      )}

      {/* 요약 리포트 모달 연동 */}
      <EventBriefingModal 
        isOpen={isBriefingModalOpen} 
        onClose={() => setIsBriefingModalOpen(false)} 
        selectedMemoryIds={selectedIds}
        queryText={activeSearchParams?.query_text || ''}
        baseEntityId={baseEntityId}
        onSaveSuccess={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['eventLogs'] });
        }}
      />
    </main>
  );
}