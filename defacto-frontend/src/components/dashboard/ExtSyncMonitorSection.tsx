'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RefreshCw, Play, CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react';
import { getExtSyncHistory, forceExtSync, getSchedulerConfig, updateSchedulerConfig } from '@/lib/api/pipeline';
import { ExtSyncHistoryItem } from '@/types/api';
import useLocaleFormatter from '@/hooks/useLocaleFormatter';

export default function ExtSyncMonitorSection() {
  const t = useTranslations('Dashboard');
  const queryClient = useQueryClient();
  const { formatTimeOnly } = useLocaleFormatter();

  const { data: history, isLoading, isError } = useQuery({
    queryKey: ['extSyncHistory'],
    queryFn: () => getExtSyncHistory(5),
    refetchInterval: 5000 
  });

  const forceMut = useMutation({
    mutationFn: forceExtSync,
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['extSyncHistory'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "실행에 실패했습니다.")
  });

  const { data: configData } = useQuery({
    queryKey: ['schedulerConfig'],
    queryFn: getSchedulerConfig,
  });

  const updateIntervalMut = useMutation({
    mutationFn: (vars: { minutes: number, is_paused: boolean }) => updateSchedulerConfig(vars.minutes, vars.is_paused),
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['schedulerConfig'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "주기 변경에 실패했습니다.")
  });

  const isPaused = configData?.data?.is_paused || false;
  const currentInterval = configData?.data?.minutes || 10;
  const dropdownValue = isPaused ? 0 : currentInterval;

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    if (val === 0) {
      updateIntervalMut.mutate({ minutes: currentInterval, is_paused: true });
    } else {
      updateIntervalMut.mutate({ minutes: val, is_paused: false });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col h-full min-h-[350px]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-emerald-600" /> {t('ext_sync')}
        </h2>
        <button 
          onClick={() => forceMut.mutate()} 
          disabled={forceMut.isPending} 
          className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
        >
          {forceMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4" />} {t('ext_force_sync')}
        </button>
      </div>

      <div className={`flex items-center gap-3 p-4 rounded-xl border mb-5 shadow-inner transition-colors ${isPaused ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="relative flex items-center justify-center w-3 h-3">
          {!isPaused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isPaused ? 'bg-yellow-500' : 'bg-emerald-500'}`}></span>
        </div>
        <span className={`text-sm font-extrabold ${isPaused ? 'text-yellow-700' : 'text-gray-700'}`}>
          {isPaused ? t('ext_paused') : t('ext_running')}
        </span>
        
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-bold text-gray-500">{t('ext_status_ctrl')}</label>
          <select 
            value={dropdownValue}
            onChange={handleIntervalChange}
            disabled={updateIntervalMut.isPending}
            className={`text-xs font-bold px-2 py-1 border rounded shadow-sm outline-none focus:ring-1 cursor-pointer disabled:opacity-50 transition-colors ${isPaused ? 'text-yellow-800 bg-yellow-100 border-yellow-300 focus:ring-yellow-500' : 'text-emerald-700 bg-white border-emerald-200 focus:ring-emerald-500'}`}
          >
            <option value={1}>{t('ext_1min')}</option>
            <option value={5}>{t('ext_5min')}</option>
            <option value={10}>{t('ext_10min')}</option>
            <option value={30}>{t('ext_30min')}</option>
            <option value={60}>{t('ext_60min')}</option>
            <option disabled>──────────</option>
            <option value={0}>{t('ext_pause_btn')}</option>
          </select>
        </div>
      </div>

      <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="flex justify-center items-center h-40"><RefreshCw className="w-6 h-6 animate-spin text-emerald-500" /></div>
        ) : isError ? (
          <div className="flex justify-center items-center h-40 text-sm font-bold text-red-400">{t('ext_load_fail')}</div>
        ) : !history || history.length === 0 ? (
          <div className="flex justify-center items-center h-40 text-sm font-bold text-gray-400">{t('ext_no_history')}</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-2.5 px-4 font-extrabold text-gray-500 uppercase text-[10px]">{t('ext_col_time')}</th>
                <th className="py-2.5 px-4 font-extrabold text-gray-500 uppercase text-[10px]">{t('ext_col_type')}</th>
                <th className="py-2.5 px-4 font-extrabold text-gray-500 uppercase text-[10px]">{t('ext_col_count')}</th>
                <th className="py-2.5 px-4 font-extrabold text-gray-500 uppercase text-[10px]">{t('ext_col_status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((item: ExtSyncHistoryItem) => (
                <tr key={item.sync_id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-xs text-gray-600">{formatTimeOnly(item.start_ts)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.sync_type === 'AUTO' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.sync_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-gray-800">{item.records_fetched}</td>
                  <td className="py-3 px-4">
                    {item.status === 'SUCCESS' && <span className="flex items-center gap-1 text-[10px] font-bold text-green-600"><CheckCircle className="w-3 h-3"/> SUCCESS</span>}
                    {item.status === 'RUNNING' && <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><RefreshCw className="w-3 h-3 animate-spin"/> RUNNING</span>}
                    {item.status === 'FAILED' && (
                       <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-red-600"><XCircle className="w-3 h-3"/> FAILED</span>
                          <span className="text-[10px] text-red-400 truncate max-w-[120px]" title={item.error_message || ''}>{item.error_message}</span>
                       </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}