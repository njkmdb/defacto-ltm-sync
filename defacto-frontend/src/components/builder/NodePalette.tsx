'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Server, ShieldCheck, Database, BrainCircuit, Plus, AlertTriangle } from 'lucide-react';
import { usePipelineStore } from '@/store/usePipelineStore';

export default function NodePalette() {
  const t = useTranslations('Builder');
  const { addNode } = usePipelineStore();

  const MODULES = [
    { id: 'LTM_Search', name: t('mod_search_name'), icon: Search, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: t('mod_search_desc') },
    { id: 'Fetch_Ext_Data', name: t('mod_ext_name'), icon: Server, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: t('mod_ext_desc') },
    { id: 'Pre_Fact_Check', name: t('mod_check_name'), icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', desc: t('mod_check_desc') },
    { id: 'LLM_Generate', name: t('mod_llm_name'), icon: BrainCircuit, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', desc: t('mod_llm_desc') },
    { id: 'Persist_DB', name: t('mod_db_name'), icon: Database, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-300', desc: t('mod_db_desc') },
    { id: 'Test_Error', name: t('mod_error_name'), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', desc: t('mod_error_desc') }
  ];

  return (
    <div className="w-[300px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-600"/> {t('palette_title')}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
        {MODULES.map(mod => (
          <div 
            key={mod.id} 
            onClick={() => addNode(mod.id)}
            className={`p-3 rounded-xl border ${mod.bg} ${mod.border} cursor-pointer hover:shadow-md transition-all flex flex-col gap-2 group`}
            title="Click to Add"
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