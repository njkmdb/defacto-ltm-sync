'use client';

import React from 'react';
import { Search, Plus, X } from 'lucide-react';

export type SearchCondition = {
  id: number;
  target: string;
  keyword: string;
  operator: 'AND' | 'OR';
};

interface DomainSearchConditionsProps {
  activeTab: 'ENTITY' | 'OBJECT' | 'STATUS';
  conditions: SearchCondition[];
  setConditions: (conditions: SearchCondition[]) => void;
  onSearch: () => void;
}

export default function DomainSearchConditions({ activeTab, conditions, setConditions, onSearch }: DomainSearchConditionsProps) {
  const addCondition = (operator: 'AND' | 'OR') => {
    setConditions([...conditions, { id: Date.now(), target: 'NAME', keyword: '', operator }]);
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
        <Search className="w-4 h-4 text-emerald-600"/> 다중 조건 상세 검색
      </label>
      <div className="flex flex-col gap-3">
        {conditions.map((cond, idx) => (
          <div key={cond.id} className="flex items-center gap-2 flex-wrap">
            {idx > 0 ? (
              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, 'operator', e.target.value as 'AND' | 'OR')}
                className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 outline-none cursor-pointer w-20 text-center shadow-sm"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            ) : (
              <span className="w-20 text-center text-xs font-bold text-gray-400 bg-gray-200 rounded-md py-2">WHERE</span>
            )}

            <select 
              value={cond.target} 
              onChange={(e) => updateCondition(cond.id, 'target', e.target.value)} 
              className="text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md px-3 py-1.5 outline-none cursor-pointer w-40 shadow-sm"
            >
              <option value="NAME">Name</option>
              <option value="ID">ID</option>
              {activeTab === 'STATUS' && <option value="CATEGORY">Category</option>}
              {activeTab !== 'STATUS' && <option value="TYPE">Type</option>}
              {activeTab !== 'STATUS' && <option value="PARENT">Parent</option>}
              {activeTab !== 'STATUS' && <option value="ATTRIBUTES">Attributes (JSONB)</option>}
            </select>
            
            <input 
              type="text" 
              placeholder="검색어 입력..." 
              value={cond.keyword}
              onChange={(e) => updateCondition(cond.id, 'keyword', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="px-3 py-1.5 text-sm border border-gray-300 bg-white rounded-md outline-none w-[27rem] font-medium text-gray-800 shadow-sm focus:ring-2 focus:ring-emerald-400"
            />

            {conditions.length > 1 && (
              <button onClick={() => removeCondition(cond.id)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors ml-1" title="조건 삭제">
                <X className="w-4 h-4" />
              </button>
            )}

            {idx === conditions.length - 1 && (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                <button onClick={() => addCondition('AND')} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <Plus className="w-3 h-3" /> AND 조건
                </button>
                <button onClick={() => addCondition('OR')} className="text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <Plus className="w-3 h-3" /> OR 조건
                </button>
                <button onClick={onSearch} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm ml-1">
                  <Search className="w-4 h-4" /> 검색 적용
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}