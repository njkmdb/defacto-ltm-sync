'use client';

import React, { useState } from 'react';
import { Database, Layers, Box, Tags } from 'lucide-react';
import EntityView from '@/components/domain/EntityView';
import ObjectView from '@/components/domain/ObjectView';
import StatusView from '@/components/domain/StatusView';

export default function DomainPage() {
  const [activeTab, setActiveTab] = useState<'ENTITY' | 'OBJECT' | 'STATUS'>('ENTITY');

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3"><Database className="w-8 h-8 text-emerald-600" /> 데이터 딕셔너리 및 마스터 관리</h1>
          <p className="text-sm text-gray-500 mt-2">비즈니스 파이프라인의 코어 딕셔너리(Status)와 확장 가능한 도메인(Entity, Object) 마스터를 관리합니다.</p>
        </div>
      </header>

      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('ENTITY')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'ENTITY' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}><Layers className="w-5 h-5" /> 주체 (Entities)</button>
        <button onClick={() => setActiveTab('OBJECT')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'OBJECT' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}><Box className="w-5 h-5" /> 객체 (Objects)</button>
        <button onClick={() => setActiveTab('STATUS')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'STATUS' ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}><Tags className="w-5 h-5" /> 상태 (Status)</button>
      </div>

      {activeTab === 'ENTITY' && <EntityView />}
      {activeTab === 'OBJECT' && <ObjectView />}
      {activeTab === 'STATUS' && <StatusView />}
    </main>
  );
}