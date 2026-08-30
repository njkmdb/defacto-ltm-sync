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

interface MemorySearchConditionsProps {
  conditions: SearchCondition[];
  setConditions: (conditions: SearchCondition[]) => void;
  onSearch: () => void;
}

export default function MemorySearchConditions({ conditions, setConditions, onSearch }: MemorySearchConditionsProps) {
  const t = useTranslations('Memory');

  const addCondition = (operator: 'AND' | 'OR') => {
    setConditions([...conditions, { id: Date.now(), target: 'CONTENT', keyword: '', operator }]);
  };

  const removeCondition = (id: number) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: number, field: keyof SearchCondition, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
        {t('cond_title')}
      </label>
      <div className="flex flex-col gap-3">
        {conditions.map((cond, idx) => (
          <div key={cond.id} className="flex items-center gap-2 flex-wrap">
            {idx > 0 ? (
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, 'operator', e.target.value as 'AND' | 'OR')}
                className="text-sm font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-md px-2 py-1.5 outline-none cursor-pointer w-20 text-center shadow-sm"
              >
                <option value="AND">{t('cond_and')}</option>
                <option value="OR">{t('cond_or')}</option>
              </select>
            ) : (
              <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-100 rounded-md py-2">{t('cond_where')}</span>
            )}

            <select 
              value={cond.target} 
              onChange={(e) => updateCondition(cond.id, 'target', e.target.value)} 
              className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 outline-none cursor-pointer w-40 shadow-sm"
            >
              <option value="CONTENT">{t('cond_opt_content')}</option>
              <option value="KEYWORDS">{t('cond_opt_keywords')}</option>
            </select>
            
            <input 
              type="text" 
              placeholder={t('cond_placeholder')}
              value={cond.keyword}
              onChange={(e) => updateCondition(cond.id, 'keyword', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md outline-none font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-purple-400"
            />

            {conditions.length > 1 && (
              <button onClick={() => removeCondition(cond.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors ml-1" title="조건 삭제">
                <X className="w-4 h-4" />
              </button>
            )}

            {idx === conditions.length - 1 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                <button onClick={() => addCondition('AND')} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <Plus className="w-3 h-3" /> {t('cond_add_and')}
                </button>
                <button onClick={() => addCondition('OR')} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <Plus className="w-3 h-3" /> {t('cond_add_or')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}