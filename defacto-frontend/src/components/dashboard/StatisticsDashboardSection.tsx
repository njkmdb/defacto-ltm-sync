'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStatistics } from '@/lib/api/pipeline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Database, BrainCircuit, RefreshCw, BarChart2 } from 'lucide-react';
import { DashboardStatisticsResponse } from '@/types/api';

export default function StatisticsDashboardSection() {
  const { data, isLoading } = useQuery<DashboardStatisticsResponse>({
    queryKey: ['dashboardStatistics'],
    queryFn: getDashboardStatistics,
    refetchInterval: 10000 // 10초마다 실시간 갱신
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex justify-center items-center mb-8">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const stats = data?.data;
  if (!stats) return null;

  // 차트 X축 라벨을 짧게(MM-DD) 변환
  const pipelineData = stats.daily_pipeline_stats.map(d => ({
    ...d,
    date: d.date.substring(5) 
  }));

  const extData = stats.ext_sync_stats.map(d => ({
    ...d,
    date: d.date.substring(5)
  }));

  return (
    <div className="mb-8 flex flex-col gap-6">
      {/* 💡 상단 KPI 카드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-indigo-50 rounded-xl"><BrainCircuit className="w-8 h-8 text-indigo-600"/></div>
          <div>
            <p className="text-sm font-bold text-gray-500">총 누적 AI 기억 (LTM)</p>
            <p className="text-3xl font-extrabold text-gray-900">{stats.total_memories.toLocaleString()} <span className="text-sm font-medium text-gray-400">건</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-emerald-50 rounded-xl"><Database className="w-8 h-8 text-emerald-600"/></div>
          <div>
            <p className="text-sm font-bold text-gray-500">관리 중인 주체 (Entities)</p>
            <p className="text-3xl font-extrabold text-gray-900">{stats.total_entities.toLocaleString()} <span className="text-sm font-medium text-gray-400">개</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-orange-50 rounded-xl"><Activity className="w-8 h-8 text-orange-600"/></div>
          <div>
            <p className="text-sm font-bold text-gray-500">최근 7일 파이프라인 처리량</p>
            <p className="text-3xl font-extrabold text-gray-900">
              {stats.daily_pipeline_stats.reduce((acc, curr) => acc + curr.total_count, 0).toLocaleString()} <span className="text-sm font-medium text-gray-400">건</span>
            </p>
          </div>
        </div>
      </div>

      {/* 💡 하단 차트 영역 (좌우 2분할) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: 파이프라인 에러 및 처리 현황 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" /> 일별 파이프라인 처리 현황 (최근 7일)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="success_count" name="성공 (Synced)" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={30} />
                <Bar dataKey="failed_count" name="실패 (Failed)" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: 외부 정형 데이터 수집 추이 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" /> 외부 정형 데이터 수집 추이 (EXT Sync)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={extData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRecords" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="records_fetched" name="수집 건수" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRecords)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}