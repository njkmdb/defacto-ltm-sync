'use client';

import React, { useState } from 'react';
import { Archive, FileText } from 'lucide-react';
import LogArchiveView from '@/components/archive/LogArchiveView';
import BriefingArchiveView from '@/components/archive/BriefingArchiveView';

export default function ArchivePage() {
  const [archiveTab, setArchiveTab] = useState<'LOGS' | 'BRIEFINGS'>('LOGS');

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Archive className="w-8 h-8 text-indigo-600" /> 일지 및 리포트 보관소
          </h1>
          <p className="text-sm text-gray-500 mt-2">AI가 합성한 단기 일지 내역과 심층 요약 리포트를 관리합니다. 2차 창작은 상단 '창작 스튜디오' 메뉴를 이용하세요.</p>
        </div>
      </header>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setArchiveTab('LOGS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${archiveTab === 'LOGS' ? 'bg-indigo-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
          <Archive className="w-5 h-5" /> 단기 일지 보관소
        </button>
        <button onClick={() => setArchiveTab('BRIEFINGS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${archiveTab === 'BRIEFINGS' ? 'bg-indigo-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
          <FileText className="w-5 h-5" /> AI 심층 요약 리포트
        </button>
      </div>

      {archiveTab === 'LOGS' && <LogArchiveView />}
      {archiveTab === 'BRIEFINGS' && <BriefingArchiveView />}
    </main>
  );
}