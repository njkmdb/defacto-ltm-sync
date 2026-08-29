'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSystemInsights } from '@/lib/api/pipeline';
import { DollarSign, Hash, Zap, AlertTriangle, Loader2, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function SystemInsightsSection() {
  const [activeTab, setActiveTab] = useState<'COST' | 'KEYWORDS' | 'RAG' | 'RISKS'>('COST');
  const baseEntityId = 1024; // 💡 현재 접속된 Tenant ID 하드코딩 주입

  const { data, isLoading } = useQuery({
    // 💡 쿼리 키 및 Fetch 함수에 baseEntityId 파라미터 연동
    queryKey: ['systemInsights', baseEntityId],
    queryFn: () => getSystemInsights(baseEntityId),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex justify-center items-center h-[280px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const insights = data?.data;
  if (!insights) return null;

  const COLORS = ['#10b981', '#6366f1', '#f59e0b'];
  const ragData = [
    { name: 'Tier 1 (Cache)', value: insights.rag_stat.cache },
    { name: 'Tier 2 (LTM)', value: insights.rag_stat.ltm },
    { name: 'Tier 3 (DWH)', value: insights.rag_stat.dwh },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col h-[280px]">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600" /> 시스템 인사이트
        </h2>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('COST')} className={`p-1.5 rounded-md transition-colors ${activeTab === 'COST' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="비용 및 토큰"><DollarSign className="w-4 h-4" /></button>
          <button onClick={() => setActiveTab('KEYWORDS')} className={`p-1.5 rounded-md transition-colors ${activeTab === 'KEYWORDS' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="핵심 키워드"><Hash className="w-4 h-4" /></button>
          <button onClick={() => setActiveTab('RAG')} className={`p-1.5 rounded-md transition-colors ${activeTab === 'RAG' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`} title="RAG 캐시 적중률"><Zap className="w-4 h-4" /></button>
          <button onClick={() => setActiveTab('RISKS')} className={`p-1.5 rounded-md transition-colors ${activeTab === 'RISKS' ? 'bg-white shadow-sm text-red-600' : 'text-gray-400 hover:text-red-600'}`} title="위험 감지"><AlertTriangle className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {activeTab === 'COST' && (
          <div className="flex flex-col h-full justify-center px-4 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-500">오늘의 누적 토큰 사용량</span>
              <span className="text-lg font-extrabold text-gray-800">{insights.cost_stat.tokens.toLocaleString()} <span className="text-xs text-gray-400">Tokens</span></span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 mb-6 overflow-hidden">
              <div className="bg-indigo-500 h-3 rounded-full" style={{ width: '45%' }}></div>
            </div>
            <div className="flex items-center justify-between bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <span className="text-sm font-extrabold text-indigo-800">예상 API 청구 비용</span>
              <span className="text-2xl font-black text-indigo-600">${insights.cost_stat.cost.toFixed(4)}</span>
            </div>
          </div>
        )}

        {activeTab === 'KEYWORDS' && (
          <div className="flex flex-wrap gap-2 animate-in fade-in zoom-in duration-300 content-start">
            {insights.hot_keywords.length === 0 && <p className="text-sm text-gray-400 font-bold m-auto mt-10">추출된 키워드가 없습니다.</p>}
            {insights.hot_keywords.map((kw: any, idx: number) => (
              <span key={idx} className="bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-xs font-bold hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-default shadow-sm">
                #{kw.text} <span className="opacity-50 ml-1 font-mono">{kw.count}</span>
              </span>
            ))}
          </div>
        )}

        {activeTab === 'RAG' && (
          <div className="flex items-center h-full animate-in fade-in zoom-in duration-300">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ragData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                    {ragData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 flex flex-col gap-3 justify-center pl-2">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span><span className="text-xs font-bold text-gray-600">T1 (Cache): {insights.rag_stat.cache}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0"></span><span className="text-xs font-bold text-gray-600">T2 (LTM): {insights.rag_stat.ltm}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span><span className="text-xs font-bold text-gray-600">T3 (DWH): {insights.rag_stat.dwh}</span></div>
            </div>
          </div>
        )}

        {activeTab === 'RISKS' && (
          <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
            {insights.risk_alerts.length === 0 && <p className="text-sm text-gray-400 font-bold m-auto mt-10">최근 감지된 위험 요소가 없습니다.</p>}
            {insights.risk_alerts.map((alert: any, idx: number) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3 items-start shadow-sm">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-800 mb-0.5 line-clamp-2 leading-relaxed">{alert.message}</p>
                  <span className="text-[10px] font-extrabold text-red-400">Entity: {alert.entity_id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}