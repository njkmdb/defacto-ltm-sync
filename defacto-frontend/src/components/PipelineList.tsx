'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPipelineStatus } from '@/lib/api';
import { ChevronLeft, ChevronRight } from 'lucide-react'; 

export default function PipelineList() {
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pipelineStatus', page, limit],
    // 💡 [핵심 교정] API 호출 시 객체 형태로 파라미터 전달 (타입스크립트 에러 및 422 에러 원천 해결)
    queryFn: () => getPipelineStatus({ page, limit }), 
    refetchInterval: 3000, 
  });

  const currentMeta = data?.meta;

  if (isLoading) return <div className="p-6 text-gray-500">파이프라인 상태를 불러오는 중...</div>;
  if (isError) return <div className="p-6 text-red-500">데이터를 불러오는 데 실패했습니다.</div>;

  const statusMap = {
    0: { label: 'PENDING', color: 'bg-yellow-100 text-yellow-700' },
    1: { label: 'SYNCED', color: 'bg-green-100 text-green-700' },
    2: { label: 'FAILED', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">파이프라인 실시간 관제</h2>
        <div className="flex gap-3 text-sm">
          <span className="text-green-600 font-medium">성공: {data?.success_count}</span>
          <span className="text-yellow-600 font-medium">대기: {data?.pending_count}</span>
          <span className="text-red-600 font-medium">실패: {data?.failed_count}</span>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th className="py-3 px-4 font-semibold">ID</th>
              <th className="py-3 px-4 font-semibold">발생일</th>
              <th className="py-3 px-4 font-semibold w-1/2">원시 데이터 (Raw Content)</th>
              <th className="py-3 px-4 font-semibold">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.data_list?.map((row: any) => (
              <tr key={row.raw_id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-900">#{row.raw_id}</td>
                <td className="py-3 px-4 text-gray-500">{row.event_date}</td>
                <td className="py-3 px-4 text-gray-700 truncate max-w-xs" title={row.raw_content}>
                  {row.raw_content || '(미디어 파일 분석 중...)'}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusMap[row.sync_status_id as keyof typeof statusMap]?.color}`}>
                    {statusMap[row.sync_status_id as keyof typeof statusMap]?.label || 'UNKNOWN'}
                  </span>
                </td>
              </tr>
            ))}
            {data?.data_list?.length === 0 && (
               <tr>
                 <td colSpan={4} className="py-10 text-center text-gray-400">데이터가 없습니다.</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border border-gray-200 bg-gray-50 shadow-sm p-3 rounded-xl">
        <span className="text-xs font-bold text-gray-500 pl-1">총 {currentMeta?.total_count || 0} 건</span>
        
        <div className="flex items-center gap-1.5">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)} 
            className="p-1.5 border border-gray-200 rounded bg-white hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: currentMeta?.total_pages || 1 }, (_, i) => i + 1).map(p => (
              <button 
                key={p} 
                onClick={() => setPage(p)} 
                className={`w-6 h-6 rounded text-xs font-bold transition-colors ${page === p ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}
          </div>
          
          <button 
            disabled={page >= (currentMeta?.total_pages || 1)} 
            onClick={() => setPage(p => p + 1)} 
            className="p-1.5 border border-gray-200 rounded bg-white hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        
        <select 
          value={limit} 
          onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} 
          className="bg-white border border-gray-300 rounded px-2 py-1 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-gray-600"
        >
          <option value={10}>10개씩 보기</option>
          <option value={20}>20개씩 보기</option>
          <option value={30}>30개씩 보기</option>
          <option value={50}>50개씩 보기</option>
        </select>
      </div>
    </div>
  );
}