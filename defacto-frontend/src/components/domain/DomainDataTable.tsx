'use client';

import React from 'react';
import { Lock, RefreshCw } from 'lucide-react';

interface DomainDataTableProps {
  activeTab: 'ENTITY' | 'OBJECT' | 'STATUS';
  isLoading: boolean;
  currentDataList: any[];
  selectedIds: number[];
  toggleSelectAll: () => void;
  toggleSelect: (id: number) => void;
  openEditModal: (record: any) => void;
}

const formatAttributes = (attrs: Record<string, any>) => {
  if (!attrs || Object.keys(attrs).length === 0) return '-';
  return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join('  |  ');
};

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
};

export default function DomainDataTable({
  activeTab, isLoading, currentDataList, selectedIds, toggleSelectAll, toggleSelect, openEditModal
}: DomainDataTableProps) {

  if (isLoading) {
    return <div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  if (!currentDataList || currentDataList.length === 0) {
    return <p className="text-center text-gray-400 font-bold py-20">조건에 일치하는 데이터가 없습니다.</p>;
  }

  return (
    <table className="w-full text-left border-collapse whitespace-nowrap">
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th className="p-3 w-12 text-center">
            <input 
              type="checkbox" 
              checked={currentDataList.length > 0 && selectedIds.length === currentDataList.filter((i:any) => !(activeTab==='STATUS' && i.status_id < 10)).length} 
              onChange={toggleSelectAll} 
              className={`w-4 h-4 rounded cursor-pointer ${activeTab === 'ENTITY' ? 'text-emerald-600' : 'text-indigo-600'}`} 
            />
          </th>
          <th className="p-3 w-20 text-xs font-extrabold text-gray-500 uppercase tracking-wider">ID</th>
          <th className="p-3 w-32 text-xs font-extrabold text-gray-500 uppercase tracking-wider">{activeTab === 'STATUS' ? 'Category' : 'Type'}</th>
          <th className="p-3 w-56 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Name</th>
          
          {activeTab !== 'STATUS' && <th className="p-3 w-24 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Parent</th>}
          
          {activeTab === 'STATUS' ? (
            <th className="p-3 w-32 text-xs font-extrabold text-gray-500 uppercase tracking-wider text-center">Status</th>
          ) : (
            <>
              <th className="p-3 w-24 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Status ID</th>
              <th className="p-3 w-56 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Attributes (JSONB)</th>
            </>
          )}
          
          <th className="p-3 w-36 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Created At</th>
          <th className="p-3 w-36 text-xs font-extrabold text-gray-500 uppercase tracking-wider">Updated At</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {currentDataList.map((record: any) => {
          const isStatus = activeTab === 'STATUS';
          const rId = isStatus ? record.status_id : (activeTab === 'ENTITY' ? record.entity_id : record.object_id);
          const isSelected = selectedIds.includes(rId);
          const isSystemCore = isStatus && rId < 10;

          return (
            <tr 
              key={rId} 
              onClick={() => toggleSelect(rId)}
              onDoubleClick={() => !isSystemCore && openEditModal(record)} 
              title={isSystemCore ? "코어 시스템 딕셔너리는 수정할 수 없습니다." : "더블클릭하여 수정 창 열기"}
              className={`transition-colors ${!isSystemCore ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-not-allowed bg-gray-50/50'} ${isSelected ? (activeTab === 'ENTITY' ? 'bg-emerald-50/50' : 'bg-indigo-50/50') : ''}`}
            >
              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                {!isSystemCore && (
                   <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(rId)} className={`w-4 h-4 rounded cursor-pointer ${activeTab === 'ENTITY' ? 'text-emerald-600' : 'text-indigo-600'}`} />
                )}
              </td>
              
              <td className="p-3 text-sm font-bold text-gray-700 flex items-center gap-1.5">
                {isSystemCore && <Lock className="w-3 h-3 text-red-400" />} {rId}
              </td>
              
              <td className="p-3">
                <span className="text-[10px] font-bold bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded">
                  {isStatus ? record.domain_category : (activeTab === 'ENTITY' ? record.entity_type : record.object_type)}
                </span>
              </td>
              
              <td className="p-3 text-sm font-bold text-gray-900 truncate max-w-[200px]">
                {isStatus ? record.status_name : (activeTab === 'ENTITY' ? record.entity_name : record.object_name)}
              </td>
              
              {!isStatus && <td className="p-3 text-sm font-medium text-gray-500">{(activeTab === 'ENTITY' ? record.parent_entity_id : record.parent_object_id) || '-'}</td>}

              {isStatus ? (
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${record.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {record.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
              ) : (
                <>
                  <td className="p-3 text-center text-sm font-bold text-gray-600">{activeTab === 'ENTITY' ? record.entity_status_id : record.object_status_id}</td>
                  <td className="p-3 text-xs font-mono text-gray-500 truncate max-w-[200px]">{formatAttributes(record.attributes)}</td>
                </>
              )}

              <td className="p-3 text-xs font-medium text-gray-400">{formatDate(record.ne_ts)}</td>
              <td className="p-3 text-xs font-medium text-gray-400">{formatDate(record.up_ts)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}