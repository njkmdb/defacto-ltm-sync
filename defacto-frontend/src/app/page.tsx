'use client';

import React from 'react';
import StatisticsDashboardSection from '@/components/dashboard/StatisticsDashboardSection';
import MediaUploadSection from '@/components/dashboard/MediaUploadSection';
import PipelineControlSection from '@/components/dashboard/PipelineControlSection';
import ContextSynthesisSection from '@/components/dashboard/ContextSynthesisSection';
import ExtSyncMonitorSection from '@/components/dashboard/ExtSyncMonitorSection';
import SystemInsightsSection from '@/components/dashboard/SystemInsightsSection';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Defacto LTM-Sync</h1>
          <p className="text-sm text-gray-500 mt-2">이벤트 기반 멀티모달 파이프라인 및 컨텍스트 관제 대시보드</p>
        </div>
      </header>

      {/* 💡 [NEW] 통계 대시보드 영역 (최상단) */}
      <StatisticsDashboardSection />

      {/* 메인 관제 영역 (좌우 2분할) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* 좌측 열 */}
        <div className="flex flex-col gap-8">
          <MediaUploadSection />
          <SystemInsightsSection />
          <PipelineControlSection />
        </div>

        {/* 우측 열 */}
        <div className="flex flex-col gap-8">
          <ExtSyncMonitorSection />
          <ContextSynthesisSection />
        </div>
      </div>
    </main>
  );
}