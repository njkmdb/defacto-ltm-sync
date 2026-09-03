'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Palette, Layers, Archive } from 'lucide-react';
import CreativeStudioEditor from '@/components/studio/CreativeStudioEditor';
import CreativeArchiveView from '@/components/studio/CreativeArchiveView';

function StudioContent() {
  const t = useTranslations('Studio');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname(); 
  
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'ARCHIVE'>('WORKSPACE');

  const sourcesParam = searchParams.get('sources');
  const sourceType = searchParams.get('sourceType') as 'LOG' | 'BRIEFING' | 'CREATION' | null;
  const sourceId = searchParams.get('sourceId') ? Number(searchParams.get('sourceId')) : null;
  const baseEntityId = searchParams.get('baseEntityId') ? Number(searchParams.get('baseEntityId')) : null;
  const tabParam = searchParams.get('tab');

  let initialSources: { type: 'LOG' | 'BRIEFING' | 'CREATION'; id: number; baseEntityId: number }[] = [];
  if (sourcesParam) {
    try {
      initialSources = sourcesParam.split(',').map(s => {
        const [tType, i, b] = s.split(':');
        return { type: tType as any, id: Number(i), baseEntityId: Number(b) };
      });
    } catch (e) {}
  } else if (sourceType && sourceId) {
    initialSources = [{ type: sourceType, id: sourceId, baseEntityId: baseEntityId || 0 }];
  }

  useEffect(() => {
    if (initialSources.length > 0) {
      setActiveTab('WORKSPACE');
    } else if (tabParam === 'ARCHIVE') {
      setActiveTab('ARCHIVE');
    }
  }, [sourcesParam, sourceType, sourceId, tabParam]);

  const clearParamsAndNavigateArchive = () => {
    router.replace(pathname); 
    setActiveTab('ARCHIVE');
  };

  return (
    <div className="flex flex-col h-full w-full">
      <header className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Palette className="w-8 h-8 text-purple-600" /> {t('title')}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {t('subtitle')}
          </p>
        </div>
        
        {/* 모드 전환 스위치 */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button 
            onClick={() => setActiveTab('WORKSPACE')} 
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'WORKSPACE' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('tab_workspace')}
          </button>
          <button 
            onClick={clearParamsAndNavigateArchive} 
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'ARCHIVE' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('tab_archive')}
          </button>
        </div>
      </header>

      {activeTab === 'WORKSPACE' && (
        <CreativeStudioEditor 
          initialSources={initialSources}
          onNavigateArchive={clearParamsAndNavigateArchive}
        />
      )}
      
      {activeTab === 'ARCHIVE' && (
        <CreativeArchiveView />
      )}
    </div>
  );
}

export default function StudioPage() {
  const t = useTranslations('Studio');
  
  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20 flex flex-col">
      <Suspense fallback={<div className="p-20 text-center font-bold text-gray-400">{t('loading')}</div>}>
        <StudioContent />
      </Suspense>
    </main>
  );
}