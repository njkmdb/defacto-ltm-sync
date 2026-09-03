'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Archive } from 'lucide-react';
import LogArchiveView from '@/components/archive/LogArchiveView';
import BriefingArchiveView from '@/components/archive/BriefingArchiveView';

function ArchiveContent() {
  const t = useTranslations('Archive');
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [archiveTab, setArchiveTab] = useState<'LOGS' | 'BRIEFINGS'>('LOGS');

  useEffect(() => {
    if (tabParam === 'LOGS' || tabParam === 'BRIEFINGS') {
      setArchiveTab(tabParam as 'LOGS' | 'BRIEFINGS');
    }
  }, [tabParam]);

  return (
    <>
      <header className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Archive className="w-8 h-8 text-indigo-600" /> {t('title')}
          </h1>
          <p className="text-sm text-gray-500 mt-2">{t('subtitle')}</p>
        </div>
        
        {/* 모드 전환 스위치 */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button 
            onClick={() => setArchiveTab('LOGS')} 
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${archiveTab === 'LOGS' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('tab_logs')}
          </button>
          <button 
            onClick={() => setArchiveTab('BRIEFINGS')} 
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${archiveTab === 'BRIEFINGS' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('tab_briefings')}
          </button>
        </div>
      </header>

      {archiveTab === 'LOGS' && <LogArchiveView />}
      {archiveTab === 'BRIEFINGS' && <BriefingArchiveView />}
    </>
  );
}

export default function ArchivePage() {
  const t = useTranslations('Archive');

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20">
      <Suspense fallback={<div className="p-20 text-center font-bold text-gray-400">{t('state_loading')}</div>}>
        <ArchiveContent />
      </Suspense>
    </main>
  );
}