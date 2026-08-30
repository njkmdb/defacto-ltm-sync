'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Search, Plus, X } from 'lucide-react';

export type SearchCondition = {
  id: number;
  target: string;
  keyword: string;
  operator: 'AND' | 'OR';
};

interface ArchiveSearchConditionsProps {
  conditions: SearchCondition[];
  setConditions: (conditions: SearchCondition[]) => void;
  onSearch: () => void;
  viewType: 'LOG' | 'BRIEFING';
}

export default function ArchiveSearchConditions({ conditions, setConditions, onSearch, viewType }: ArchiveSearchConditionsProps) {
  const t = useTranslations('Archive');

  const addCondition = (operator: 'AND' | 'OR') => {
    setConditions([...conditions, { id: Date.now(), target: 'SUMMARY', keyword: '', operator }]);
  };

  const removeCondition = (id: number) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: number, field: keyof SearchCondition, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <label className="block text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-indigo-600"/> {t('search_title')}
      </label>
      <div className="flex flex-col gap-3">
        {conditions.map((cond, idx) => (
          <div key={cond.id} className="flex items-center gap-2 flex-wrap">
            {idx > 0 ? (
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, 'operator', e.target.value as 'AND' | 'OR')}
                className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-1.5 outline-none cursor-pointer w-20 text-center shadow-sm"
              >
                <option value="AND">{t('search_and')}</option>
                <option value="OR">{t('search_or')}</option>
              </select>
            ) : (
              <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">{t('search_where')}</span>
            )}

            <select 
              value={cond.target} 
              onChange={(e) => updateCondition(cond.id, 'target', e.target.value)} 
              className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 outline-none cursor-pointer w-48 shadow-sm"
            >
              <option value="SUMMARY">{t('search_target_summary')}</option>
              <option value="ENTITY_ID">{t('search_target_entity_id')}</option>
              {viewType === 'LOG' ? (
                <>
                  <option value="LOG_ID">{t('search_target_log_id')}</option>
                  <option value="ACTION_ITEMS">{t('search_target_action_items')}</option>
                </>
              ) : (
                <>
                  <option value="BRIEFING_ID">{t('search_target_briefing_id')}</option>
                  <option value="QUERY">{t('search_target_query')}</option>
                </>
              )}
            </select>
            
            <input 
              type="text" 
              placeholder={t('search_placeholder')}
              value={cond.keyword}
              onChange={(e) => updateCondition(cond.id, 'keyword', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md outline-none w-[27rem] font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-indigo-400"
            />

            {conditions.length > 1 && (
              <button onClick={() => removeCondition(cond.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors ml-1">
                <X className="w-4 h-4" />
              </button>
            )}

            {idx === conditions.length - 1 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                <button onClick={() => addCondition('AND')} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <Plus className="w-3 h-3" /> {t('search_and')}
                </button>
                <button onClick={() => addCondition('OR')} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <Plus className="w-3 h-3" /> {t('search_or')}
                </button>
                <button onClick={onSearch} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm ml-1">
                  <Search className="w-4 h-4" /> {t('search_apply')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}