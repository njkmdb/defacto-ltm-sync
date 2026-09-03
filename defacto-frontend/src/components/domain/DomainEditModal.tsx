'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Plus, RefreshCw, Save } from 'lucide-react';
import useLocaleFormatter from '@/hooks/useLocaleFormatter';

interface DomainEditModalProps {
  activeTab: 'ENTITY' | 'OBJECT';
  isOpen: boolean;
  onClose: () => void;
  initialData: any | null;
  onSave: (data: any) => void;
  isPending: boolean;
  currentFilterTypes: string[];
  statusOptionsData: any;
}

export default function DomainEditModal({
  activeTab, isOpen, onClose, initialData, onSave, isPending, currentFilterTypes, statusOptionsData
}: DomainEditModalProps) {
  const t = useTranslations('Domain');
  const tCommon = useTranslations('Common');
  const { formatDateTime } = useLocaleFormatter();

  const [formData, setFormData] = useState({ id: '' as string | number, name: '', type: '', parent_id: '' as string | number, status_id: 1, aliases: '', attributes: [] as {key: string, value: string}[], ne_ts: '', up_ts: '' });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({ id: '', name: '', type: '', parent_id: '', status_id: 1, aliases: '', attributes: [], ne_ts: '', up_ts: '' });
      }
    }
  }, [isOpen, initialData]);

  const handleSaveClick = () => {
    if (!formData.name.trim() || !formData.type.trim()) return alert(t('alert_name_type_req'));
    const finalAttributes: Record<string, any> = {};
    formData.attributes.forEach(a => { if (a.key.trim()) finalAttributes[a.key.trim()] = a.value; });
    const aliasList = formData.aliases.split(',').map(s => s.trim()).filter(Boolean);
    if (aliasList.length > 0) finalAttributes['aliases'] = aliasList;
    
    onSave({ ...formData, finalAttributes });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
        <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
            {initialData ? t('modal_edit_master', { id: initialData.id }) : t('modal_add_master')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_id')} <span className="font-normal text-xs text-gray-400">{t('modal_id_opt')}</span></label>
              <input type="number" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} placeholder={t('modal_id_auto')} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500`} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_type')} <span className="text-red-500">*</span></label>
              <input type="text" list="type-options" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value.toUpperCase()})} placeholder={t('modal_type_placeholder')} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 uppercase focus:ring-emerald-500`} />
              <datalist id="type-options">{currentFilterTypes.map((t: string) => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_parent')}</label>
              <input type="number" value={formData.parent_id} onChange={(e) => setFormData({...formData, parent_id: e.target.value})} placeholder="e.g. 1" className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_name')} <span className="text-red-500">*</span></label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-emerald-500`} />
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
             <label className="block text-sm font-bold text-emerald-800 mb-2">{t('modal_biz_status')}</label>
             <select value={formData.status_id} onChange={(e) => setFormData({...formData, status_id: Number(e.target.value)})} className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-400">
                {statusOptionsData?.data?.map((s: any) => <option key={s.status_id} value={s.status_id}>ID: {s.status_id} - {s.status_name}</option>)}
                {(!statusOptionsData?.data?.some((s:any) => s.status_id === 1)) && <option value={1}>ID: 1 - SYNCED</option>}
             </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_aliases')}</label>
            <input 
              type="text" 
              value={formData.aliases} 
              onChange={(e) => setFormData({...formData, aliases: e.target.value})} 
              placeholder={t('modal_aliases_hint')} 
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" 
            />
            <p className="text-[10px] text-gray-400 mt-1 font-bold">{t('modal_aliases_desc')}</p>
          </div>

          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">{t('modal_attr_title')}</h3>
              <button onClick={() => setFormData({...formData, attributes: [...formData.attributes, {key: '', value: ''}]})} className="text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-1 rounded transition-colors flex items-center gap-1"><Plus className="w-3 h-3" /> {t('modal_attr_add')}</button>
            </div>
            <div className="space-y-3">
              {formData.attributes.length === 0 && <p className="text-xs text-gray-400 font-bold">{t('modal_attr_empty')}</p>}
              {formData.attributes.map((attr: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" placeholder={t('modal_attr_key')} value={attr.key} onChange={(e) => { const newAttrs = [...formData.attributes]; newAttrs[idx].key = e.target.value; setFormData({...formData, attributes: newAttrs}); }} className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm outline-none font-mono focus:border-emerald-500" />
                  <input type="text" placeholder={t('modal_attr_val')} value={attr.value} onChange={(e) => { const newAttrs = [...formData.attributes]; newAttrs[idx].value = e.target.value; setFormData({...formData, attributes: newAttrs}); }} className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-emerald-500" />
                  <button onClick={() => { const newAttrs = formData.attributes.filter((_: any, i: number) => i !== idx); setFormData({...formData, attributes: newAttrs}); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {initialData && (
          <div className="mt-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex gap-4 text-xs font-medium text-gray-400">
              <span><strong className="text-gray-500">{t('modal_created_at')}</strong> {formatDateTime(formData.ne_ts)}</span>
              <span><strong className="text-gray-500">{t('modal_updated_at')}</strong> {formatDateTime(formData.up_ts)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-200 transition-colors">{tCommon('cancel')}</button>
          <button onClick={handleSaveClick} disabled={isPending} className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 shadow-md">
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}