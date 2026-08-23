'use client';

import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import SingleSynthesisView from './SingleSynthesisView';
import BulkSynthesisView from './BulkSynthesisView';

export default function ContextSynthesisSection() {
  const [mode, setMode] = useState<'SINGLE' | 'BULK'>('SINGLE');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col h-[750px]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" /> 프로세스 B: 컨텍스트 합성 보드
        </h2>
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setMode('SINGLE')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'SINGLE' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>단일 주체 합성</button>
          <button onClick={() => setMode('BULK')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${mode === 'BULK' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>일괄 대량 합성</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {mode === 'SINGLE' ? <SingleSynthesisView /> : <BulkSynthesisView />}
      </div>
    </div>
  );
}