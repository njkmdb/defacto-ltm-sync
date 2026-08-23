'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Palette, Layers, Archive } from 'lucide-react';
import CreativeStudioEditor from '@/components/studio/CreativeStudioEditor';
import CreativeArchiveView from '@/components/studio/CreativeArchiveView';

function StudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'ARCHIVE'>('WORKSPACE');

  const sourcesParam = searchParams.get('sources');
  const sourceType = searchParams.get('sourceType') as 'LOG' | 'BRIEFING' | 'CREATION' | null;
  const sourceId = searchParams.get('sourceId') ? Number(searchParams.get('sourceId')) : null;
  const baseEntityId = searchParams.get('baseEntityId') ? Number(searchParams.get('baseEntityId')) : null;

  let initialSources: { type: 'LOG' | 'BRIEFING' | 'CREATION'; id: number; baseEntityId: number }[] = [];
  if (sourcesParam) {
    try {
      initialSources = sourcesParam.split(',').map(s => {
        const [t, i, b] = s.split(':');
        return { type: t as any, id: Number(i), baseEntityId: Number(b) };
      });
    } catch (e) {}
  } else if (sourceType && sourceId) {
    initialSources = [{ type: sourceType, id: sourceId, baseEntityId: baseEntityId || 0 }];
  }

  useEffect(() => {
    if (initialSources.length > 0) {
      setActiveTab('WORKSPACE');
    }
  }, [sourcesParam, sourceType, sourceId]);

  const clearParamsAndNavigateArchive = () => {
    router.replace('/studio'); 
    setActiveTab('ARCHIVE');
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex gap-4 mb-6 shrink-0">
        <button 
          onClick={() => setActiveTab('WORKSPACE')} 
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'WORKSPACE' ? 'bg-purple-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
        >
          <Layers className="w-5 h-5" /> 2차 창작 워크스페이스
        </button>
        <button 
          onClick={clearParamsAndNavigateArchive} 
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'ARCHIVE' ? 'bg-purple-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
        >
          <Archive className="w-5 h-5" /> 2차 창작 아카이브
        </button>
      </div>

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
  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20 flex flex-col">
      <header className="mb-8 border-b border-gray-200 pb-4 shrink-0">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
          <Palette className="w-8 h-8 text-purple-600" /> 2차 창작 스튜디오
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          원문 데이터를 다양한 톤앤매너로 재창조하는 능동적인 워크스페이스와 생성된 창작물 보관소를 통합 관리합니다.
        </p>
      </header>
      
      <Suspense fallback={<div className="p-20 text-center font-bold text-gray-400">스튜디오 로딩 중...</div>}>
        <StudioContent />
      </Suspense>
    </main>
  );
}