'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, X, AlertCircle, Database, RefreshCw } from 'lucide-react';

interface BulkPreviewModalProps {
  activeTab: 'ENTITY' | 'OBJECT' | 'STATUS';
  isOpen: boolean;
  onClose: () => void;
  previewData: any[];
  previewErrors: number;
  onConfirm: () => void;
  isPending: boolean;
}

const formatAttributes = (attrs: Record<string, any>) => {
  if (!attrs || Object.keys(attrs).length === 0) return '-';
  return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join('  |  ');
};

export default function BulkPreviewModal({
  activeTab, isOpen, onClose, previewData, previewErrors, onConfirm, isPending
}: BulkPreviewModalProps) {
  const t = useTranslations('Domain');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl w-[1200px] max-w-[95vw] h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-blue-600" /> {t('preview_title', { type: activeTab })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{t('preview_desc', { count: previewData.length })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded transition-colors"><X className="w-6 h-6" /></button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          {previewErrors > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm font-bold">
              <AlertCircle className="w-5 h-5" /> {t('preview_err', { count: previewErrors })}
            </div>
          )}
          <table className="w-full text-left border-collapse bg-white shadow-sm rounded-lg overflow-hidden text-sm">
            <thead className="bg-gray-100 border-b border-gray-200 text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-3 w-16 text-center">{t('col_row')}</th>
                <th className="p-3 w-24">ID</th>
                <th className="p-3 w-32">Type <span className="text-red-500">*</span></th>
                <th className="p-3 w-48">Name <span className="text-red-500">*</span></th>
                <th className="p-3 w-24">Parent</th>
                <th className="p-3">Attributes (JSONB)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {previewData.map((row, i: number) => (
                <tr key={i} className={row.hasError ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                  <td className="p-3 text-center text-gray-400 font-bold">{row.index}</td>
                  <td className="p-3 font-semibold text-gray-700">{row.id || <span className="text-blue-400 text-[10px] bg-blue-50 px-1 rounded">{t('modal_id_auto')}</span>}</td>
                  <td className="p-3">{row.type ? <span className="font-bold bg-white border px-1.5 py-0.5 rounded text-[10px]">{row.type}</span> : <span className="text-red-500 font-bold">Null</span>}</td>
                  <td className="p-3 font-bold text-gray-800">{row.name || <span className="text-red-500">Null</span>}</td>
                  <td className="p-3 text-gray-500">{row.parent_id || '-'}</td>
                  <td className="p-3 text-xs font-mono text-gray-500">{formatAttributes(row.attributes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors">{t('preview_cancel')}</button>
          <button onClick={onConfirm} disabled={previewErrors > 0 || isPending} className="flex items-center gap-2 text-white px-8 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-md">
            {isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />} {t('preview_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}