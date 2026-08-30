'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getPipelineStatus } from '@/lib/api/pipeline';
import { ChevronLeft, ChevronRight } from 'lucide-react'; 
import useLocaleFormatter from '@/hooks/useLocaleFormatter';

export default function PipelineList() {
  const t = useTranslations('Dashboard');
  const baseEntityId = 1024;
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const { formatDateOnly } = useLocaleFormatter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pipelineStatus', baseEntityId, page, limit],
    queryFn: () => getPipelineStatus({ baseEntityId, page, limit }), 
    refetchInterval: 3000, 
  });

  const currentMeta = data?.meta;

  if (isLoading) return <div className="p-6 text-gray-500">{t('pipe_list_status_loading')}</div>;
  if (isError) return <div className="p-6 text-red-500">{t('pipe_list_status_error')}</div>;

  const statusMap = {
    0: { label: 'PENDING', color: 'bg-yellow-100 text-yellow-700' },
    1: { label: 'SYNCED', color: 'bg-green-100 text-green-700' },
    2: { label: 'FAILED', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">{t('pipe_list_title')}</h2>
        <div className="flex gap-3 text-sm">
          <span className="text-green-600 font-medium">{t('pipe_list_success')} {data?.success_count}</span>
          <span className="text-yellow-600 font-medium">{t('pipe_list_pending')} {data?.pending_count}</span>
          <span className="text-red-600 font-medium">{t('pipe_list_failed')} {data?.failed_count}</span>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th className="py-3 px-4 font-semibold">{t('pipe_list_col_id')}</th>
              <th className="py-3 px-4 font-semibold">{t('pipe_list_col_date')}</th>
              <th className="py-3 px-4 font-semibold w-1/2">{t('pipe_list_col_raw')}</th>
              <th className="py-3 px-4 font-semibold">{t('pipe_list_col_status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.data_list?.map((row: any) => (
              <tr key={row.raw_id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-900">#{row.raw_id}</td>
                <td className="py-3 px-4 text-gray-500">{formatDateOnly(row.event_date)}</td>
                <td className="py-3 px-4 text-gray-700 truncate max-w-xs" title={row.raw_content}>
                  {row.raw_content || t('pipe_list_analyzing')}
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
                 <td colSpan={4} className="py-10 text-center text-gray-400">{t('pipe_list_empty')}</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border border-gray-200 bg-gray-50 shadow-sm p-3 rounded-xl">
        <span className="text-xs font-bold text-gray-500 pl-1">{t('pipe_total', { count: currentMeta?.total_count || 0 })}</span>
        
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
          <option value={10}>{t('pipe_list_view_10')}</option>
          <option value={20}>{t('pipe_list_view_20')}</option>
          <option value={30}>{t('pipe_list_view_30')}</option>
          <option value={50}>{t('pipe_list_view_50')}</option>
        </select>
      </div>
    </div>
  );
}