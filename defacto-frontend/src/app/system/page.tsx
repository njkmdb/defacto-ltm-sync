'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, Search, Table2, Layers, Server, RefreshCw, ChevronLeft, ChevronRight, Hash, Plus, X, XCircle } from 'lucide-react';
import { getSystemTables, getSystemTableData } from '@/lib/api/pipeline';

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export type SearchCondition = {
  id: number;
  target: string;
  keyword: string;
  operator: 'AND' | 'OR';
};

export default function SystemDataExplorerPage() {
  const [activeSchema, setActiveSchema] = useState<'ext' | 'core' | 'domain' | 'raw'>('ext');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: '', keyword: '', operator: 'AND' }]);
  const [appliedConditions, setAppliedConditions] = useState<SearchCondition[]>([]);

  // 💡 [NEW] 상세 열람 모달을 위한 상태 추가
  const [selectedRowData, setSelectedRowData] = useState<any | null>(null);

  const { data: tablesData, isLoading: isTablesLoading } = useQuery({
    queryKey: ['systemTables', activeSchema],
    queryFn: () => getSystemTables(activeSchema)
  });

  const { data: tableData, isLoading: isDataLoading, isFetching } = useQuery({
    queryKey: ['systemTableData', activeSchema, selectedTable, page, limit, appliedConditions],
    queryFn: () => {
      if (!selectedTable) return null;
      return getSystemTableData(activeSchema, selectedTable, page, limit, appliedConditions);
    },
    enabled: !!selectedTable
  });

  useEffect(() => {
    if (tableData?.data?.columns && tableData.data.columns.length > 0) {
      setConditions(prev => {
        if (!prev[0].target) {
          return prev.map(c => ({ ...c, target: tableData.data.columns[0] }));
        }
        return prev;
      });
    }
  }, [tableData?.data?.columns]);

  const handleSchemaChange = (schema: 'ext' | 'core' | 'domain' | 'raw') => {
    setActiveSchema(schema);
    setSelectedTable(null);
    setPage(1);
    resetFilters();
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
    resetFilters();
  };

  const resetFilters = () => {
    setConditions([{ id: Date.now(), target: '', keyword: '', operator: 'AND' }]);
    setAppliedConditions([]);
  };

  const handleSearch = () => {
    setPage(1);
    setAppliedConditions([...conditions]);
  };

  const currentMeta = tableData?.meta;

  const renderCellValue = (val: any) => {
    if (val === null || val === undefined) return <span className="text-gray-300 italic">null</span>;
    if (typeof val === 'boolean') return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{val ? 'TRUE' : 'FALSE'}</span>;

    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);

    if (strVal.length > 50) {
       const tooltip = strVal.length > 500 ? strVal.substring(0, 500) + '... (Data too large to display)' : strVal;
       return (
         <span className="truncate max-w-[200px] block cursor-help" title={tooltip}>
           {strVal.substring(0, 50)}...
         </span>
       );
    }

    return typeof val === 'object' 
      ? <span className="font-mono text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">{strVal}</span> 
      : strVal;
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20 flex flex-col h-screen">
      <header className="mb-6 border-b border-gray-200 pb-4 shrink-0">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <Server className="w-8 h-8 text-teal-600" /> 시스템 데이터 탐색기 (Read-Only)
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          로컬 데이터베이스의 ext, core, domain 스키마 내 모든 물리 테이블을 직접 열람합니다. (수정/삭제 불가)
        </p>
      </header>

      <div className="flex gap-4 mb-6 shrink-0 items-center justify-between">
        <div className="flex gap-4">
          <button onClick={() => handleSchemaChange('ext')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeSchema === 'ext' ? 'bg-teal-800 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            <Database className="w-5 h-5" /> EXT (외부 데이터)
          </button>
          <button onClick={() => handleSchemaChange('core')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeSchema === 'core' ? 'bg-indigo-800 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            <Layers className="w-5 h-5" /> CORE (팩트/메모리)
          </button>
          <button onClick={() => handleSchemaChange('domain')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeSchema === 'domain' ? 'bg-emerald-800 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            <Server className="w-5 h-5" /> DOMAIN (마스터)
          </button>
          <button onClick={() => handleSchemaChange('raw')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeSchema === 'raw' ? 'bg-gray-800 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            <Hash className="w-5 h-5" /> RAW (원시 데이터)
          </button>
        </div>
        
        {appliedConditions.length > 0 && (
          <button onClick={resetFilters} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm flex items-center gap-1">
            <XCircle className="w-4 h-4" /> 검색 초기화
          </button>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* 좌측 패널: 테이블 목록 */}
        <div className="w-[280px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col shrink-0">
          <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
            <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2 uppercase">
              <Table2 className="w-4 h-4 text-teal-600"/> {activeSchema} TABLES
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {isTablesLoading ? (
               <div className="py-10 flex justify-center text-teal-500"><RefreshCw className="w-6 h-6 animate-spin"/></div>
            ) : tablesData?.data?.length === 0 ? (
               <p className="text-center text-sm font-bold text-gray-400 py-10">테이블이 없습니다.</p>
            ) : (
               tablesData?.data?.map((tableName: string) => (
                 <button
                   key={tableName}
                   onClick={() => handleTableSelect(tableName)}
                   className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${selectedTable === tableName ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm' : 'bg-white text-gray-600 border border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                 >
                   {tableName}
                   {selectedTable === tableName && <ChevronRight className="w-4 h-4 text-teal-500" />}
                 </button>
               ))
            )}
          </div>
        </div>

        {/* 우측 패널: 데이터 뷰어 Grid */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
               <Database className="w-16 h-16 mb-4 text-gray-200" />
               <p className="text-lg font-bold">좌측에서 조회할 테이블을 선택해주세요.</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-800">
                  <Search className="w-5 h-5 text-teal-600" /> {selectedTable} 데이터
                </h3>
                <div className="flex items-center gap-3">
                  {isFetching && <span className="flex items-center gap-1.5 text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-full"><RefreshCw className="w-3.5 h-3.5 animate-spin"/> 로딩 중...</span>}
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100 flex items-center gap-1">🔒 Read-Only</span>
                </div>
              </div>

              {tableData?.data?.columns && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 m-4 shrink-0">
                  <label className="block text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-teal-600"/> 다중 조건 상세 검색
                  </label>
                  <div className="flex flex-col gap-3">
                    {conditions.map((cond, idx) => (
                      <div key={cond.id} className="flex items-center gap-2 flex-wrap">
                        {idx > 0 ? (
                          <select value={cond.operator} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, operator: e.target.value as 'AND' | 'OR' } : c))} className="text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-1.5 outline-none cursor-pointer w-20 text-center shadow-sm">
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        ) : (
                          <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">WHERE</span>
                        )}
                        
                        <select value={cond.target} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, target: e.target.value } : c))} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 outline-none cursor-pointer w-48 shadow-sm">
                          {tableData.data.columns.map((col: string) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        
                        <input type="text" value={cond.keyword} onChange={(e) => setConditions(conditions.map(c => c.id === cond.id ? { ...c, keyword: e.target.value } : c))} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md outline-none font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-teal-400" placeholder="검색어 입력..." />
                        
                        {conditions.length > 1 && <button onClick={() => setConditions(conditions.filter(c => c.id !== cond.id))} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><X className="w-4 h-4" /></button>}
                        
                        {idx === conditions.length - 1 && (
                          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                            <button onClick={() => setConditions([...conditions, { id: Date.now(), target: tableData.data.columns[0] || '', keyword: '', operator: 'AND' }])} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> AND</button>
                            <button onClick={() => setConditions([...conditions, { id: Date.now(), target: tableData.data.columns[0] || '', keyword: '', operator: 'OR' }])} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm"><Plus className="w-3 h-3" /> OR</button>
                            <button onClick={handleSearch} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm ml-1"><Search className="w-4 h-4" /> 검색 적용</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto bg-white relative">
                 {isDataLoading && !tableData ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10"><RefreshCw className="w-8 h-8 animate-spin text-teal-500"/></div>
                 ) : tableData?.data?.rows?.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 font-bold">
                       <Table2 className="w-12 h-12 mb-3 text-gray-200"/>
                       <p>테이블에 데이터가 존재하지 않습니다.</p>
                    </div>
                 ) : (
                    <div className="inline-block min-w-full align-middle border-t border-gray-200 bg-white shadow-sm overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-left whitespace-nowrap border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                          <tr>
                            <th className="p-3 w-16 text-center text-xs font-extrabold text-gray-400 uppercase border-r border-gray-200">#</th>
                            {tableData?.data?.columns?.map((col: string) => (
                              <th key={col} className="p-3 text-xs font-extrabold text-gray-600 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100 text-sm">
                          {/* 💡 [UX Update] tr에 cursor-pointer 적용 및 더블 클릭 이벤트 바인딩 */}
                          {tableData?.data?.rows?.map((row: any, idx: number) => (
                            <tr 
                              key={idx} 
                              onDoubleClick={() => setSelectedRowData(row)}
                              className="hover:bg-teal-50/50 transition-colors cursor-pointer"
                              title="더블클릭하여 상세 내용 보기"
                            >
                              <td className="p-3 text-center text-xs font-bold text-gray-400 bg-gray-50 border-r border-gray-100">{(page - 1) * limit + idx + 1}</td>
                              {tableData.data.columns.map((col: string) => (
                                <td key={`${idx}-${col}`} className="px-4 py-2.5 text-gray-700 border-r border-gray-50 last:border-r-0">
                                  {renderCellValue(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                 )}
              </div>

              {currentMeta && (
                <div className="p-3 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                   <span className="text-sm font-bold text-gray-500 pl-2">총 {currentMeta.total_count.toLocaleString()} 건</span>
                   <div className="flex items-center gap-2">
                     <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors bg-white"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                     <div className="flex gap-1">
                       {getPageNumbers(page, currentMeta.total_pages).map(p => (
                         <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-sm font-bold transition-colors ${page === p ? 'bg-teal-600 text-white shadow-sm' : 'bg-transparent text-gray-600 hover:bg-gray-200'}`}>{p}</button>
                       ))}
                     </div>
                     <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors bg-white"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
                   </div>
                   <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-teal-500 text-xs font-bold text-gray-600 shadow-sm cursor-pointer">
                     <option value={20}>20개씩 보기</option>
                     <option value={50}>50개씩 보기</option>
                     <option value={100}>100개씩 보기</option>
                     <option value={500}>500개씩 보기</option>
                   </select>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 💡 [NEW] 상세 열람 전용 모달 */}
      {selectedRowData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-[800px] max-w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gray-900 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-400"/> 레코드 상세 열람
              </h2>
              <button onClick={() => setSelectedRowData(null)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50 space-y-4">
              {tableData?.data?.columns?.map((col: string) => {
                const val = selectedRowData[col];
                let displayVal = val;
                let isJson = false;

                if (val === null || val === undefined) {
                  displayVal = 'null';
                } else if (typeof val === 'boolean') {
                  displayVal = val ? 'TRUE' : 'FALSE';
                } else if (typeof val === 'object') {
                  displayVal = JSON.stringify(val, null, 2);
                  isJson = true;
                } else {
                  try {
                    const parsed = JSON.parse(val);
                    if (typeof parsed === 'object' && parsed !== null) {
                      displayVal = JSON.stringify(parsed, null, 2);
                      isJson = true;
                    }
                  } catch(e) {}
                }

                return (
                  <div key={col} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <label className="block text-xs font-extrabold text-teal-700 uppercase mb-2">{col}</label>
                    {isJson ? (
                      <pre className="text-xs text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 overflow-x-auto font-mono whitespace-pre-wrap">
                        {displayVal}
                      </pre>
                    ) : (
                      <div className="text-sm text-gray-800 font-medium whitespace-pre-wrap break-all">
                        {String(displayVal)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}