'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { updateRawEvent } from '@/lib/api/pipeline';

interface EditRawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: { rawId: number; baseEntityId: number; content: string; date: string } | null;
  onDeleteRequest?: (rawId: number) => void;
}

export default function EditRawModal({ isOpen, onClose, onSuccess, initialData, onDeleteRequest }: EditRawModalProps) {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');

  const [editData, setEditData] = useState({ rawId: 0, baseEntityId: 0, content: '', date: '', runNow: true });

  useEffect(() => {
    if (initialData && isOpen) {
      setEditData({
        rawId: initialData.rawId,
        baseEntityId: initialData.baseEntityId,
        content: initialData.content,
        date: initialData.date, 
        runNow: true
      });
    }
  }, [initialData, isOpen]);

  const updateMutation = useMutation({
    mutationFn: ({ rawId, req }: { rawId: number, req: any }) => updateRawEvent(rawId, req),
    onSuccess: (data) => {
      alert(data.message);
      onSuccess();
      onClose();
    },
    onError: (error: any) => alert(error.response?.data?.detail || t('alert_edit_fail'))
  });

  const handleEditSubmit = () => {
    if (!editData.content.trim()) return alert(t('alert_req_text'));
    updateMutation.mutate({
      rawId: editData.rawId,
      req: {
        base_entity_id: editData.baseEntityId, 
        event_date: editData.date,
        raw_content: editData.content,
        run_pipeline_now: editData.runNow,
        schema_name: 'HierarchicalFactSchema'
      }
    });
  };

  const handleDelete = () => {
    if (onDeleteRequest) {
      onDeleteRequest(editData.rawId);
    }
  };

  if (!isOpen || !initialData) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-2xl w-[1000px] max-w-[95vw] shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Edit2 className="w-6 h-6 text-gray-600" /> {t('modal_edit_title', { id: editData.rawId })}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200 leading-relaxed">
          {t('modal_edit_desc')}
        </p>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 w-2/3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('modal_base_entity')}</label>
              <input 
                type="number" 
                value={editData.baseEntityId} 
                onChange={e => setEditData({...editData, baseEntityId: parseInt(e.target.value) || 0})} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base font-semibold text-gray-800" 
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('modal_event_date')}</label>
              <input 
                type="date" 
                value={editData.date} 
                onChange={e => setEditData({...editData, date: e.target.value})} 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base font-semibold text-gray-800" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">{t('modal_raw_content')}</label>
            <textarea 
              value={editData.content} 
              onChange={e => setEditData({...editData, content: e.target.value})} 
              className="w-full h-72 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-base resize-none leading-relaxed" 
            />
          </div>

          <div className="flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <input 
              type="checkbox" 
              id="runNowEdit" 
              checked={editData.runNow} 
              onChange={e => setEditData({...editData, runNow: e.target.checked})} 
              className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="runNowEdit" className="text-base font-semibold text-blue-800 cursor-pointer">
              {t('modal_run_now_edit')}
            </label>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button 
            onClick={handleDelete}
            className="px-4 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('modal_delete')}
          </button>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-200 transition-colors">
              {tCommon('cancel')}
            </button>
            <button 
              onClick={handleEditSubmit} 
              disabled={updateMutation.isPending} 
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-base font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {updateMutation.isPending && <RefreshCw className="w-5 h-5 animate-spin" />} {t('modal_edit_save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}