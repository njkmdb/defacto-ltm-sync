'use client';

import React from 'react';
import { Search, Server, ShieldCheck, Database, BrainCircuit, Plus, AlertTriangle } from 'lucide-react';
import { usePipelineStore } from '@/store/usePipelineStore';

const MODULES = [
  { id: 'LTM_Search', name: 'LTM 과거 기억 검색', icon: Search, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: 'RAG를 통해 관련 팩트를 검색합니다.' },
  { id: 'Fetch_Ext_Data', name: '외부 정형 데이터 인출', icon: Server, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: '외부 정형 데이터를 조회합니다.' },
  { id: 'Pre_Fact_Check', name: '사전 팩트 체크 (교차검증)', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', desc: '데이터 간 모순과 환각을 방지합니다.' },
  { id: 'LLM_Generate', name: 'LLM 데이터 구조화/합성', icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', desc: '프롬프트를 통해 텍스트를 구조화합니다.' },
  { id: 'Persist_DB', name: '물리 DB 저장 (Upsert)', icon: Database, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300', desc: '결과물을 시스템 테이블에 Upsert 합니다.' },
  { id: 'Test_Error', name: '트랜잭션 롤백 테스트', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', desc: '의도적 에러를 발생시켜 DB 롤백을 검증합니다.' }
];

export default function NodePalette() {
  const { addNode } = usePipelineStore();

  return (
    <div className="w-[300px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-600"/> 사용 가능한 코어 모듈
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
        {MODULES.map(mod => (
          <div 
            key={mod.id} 
            onClick={() => addNode(mod.id)}
            className={`p-3 rounded-xl border ${mod.bg} ${mod.border} cursor-pointer hover:shadow-md transition-all flex flex-col gap-2 group`}
            title="클릭하여 캔버스에 추가"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <mod.icon className={`w-5 h-5 ${mod.color}`} />
                <span className="text-sm font-extrabold text-gray-800">{mod.name}</span>
              </div>
              <button className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="w-4 h-4"/></button>
            </div>
            <span className="text-[10px] font-mono text-gray-500">{mod.id}</span>
            <p className="text-[9px] text-gray-400 leading-tight">{mod.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}