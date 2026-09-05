'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import useLocaleFormatter from '@/hooks/useLocaleFormatter';

interface StatusEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: any | null;
  onSave: (data: any) => void;
  isPending: boolean;
  onDelete: (id: number) => void;
  isDeletePending: boolean;
}

export default function StatusEditModal({
  isOpen, onClose, initialData, onSave, isPending, onDelete, isDeletePending
}: StatusEditModalProps) {
  const t = useTranslations('Domain');
  const tCommon = useTranslations('Common');
  const { formatDateTime } = useLocaleFormatter();

  const [formData, setFormData] = useState({ id: '' as string | number, name: '', type: 'ENTITY', is_active: true, ne_ts: '', up_ts: '', attributes: [] as {key: string, value: string}[] });

  // --- Drag and Drop State ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (!isOpen) setPosition({ x: 0, y: 0 }); // 닫힐 때 위치 초기화
  }, [isOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      setPosition({
        x: dragStart.current.posX + deltaX,
        y: dragStart.current.posY + deltaY
      });
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  };
  // ---------------------------

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else {
        setFormData({ id: '', name: '', type: 'ENTITY', is_active: true, ne_ts: '', up_ts: '', attributes: [] });
      }
    }
  }, [isOpen, initialData]);

  const handleSaveClick = () => {
    if (!formData.name.trim() || !formData.type.trim() || !formData.id) return alert(t('alert_id_name_cat_req'));
    const finalAttributes: Record<string, any> = {};
    formData.attributes.forEach((a: any) => { if (a.key.trim()) finalAttributes[a.key.trim()] = a.value; });
    
    onSave({ ...formData, finalAttributes });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-2xl flex flex-col shadow-2xl border border-gray-100 relative"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: '600px',
          minWidth: '400px',
          minHeight: '400px',
          maxHeight: '90vh',
          resize: 'both',
          overflow: 'hidden'
        }}
      >
        <div 
          className="px-8 py-6 flex items-center justify-between border-b border-gray-100 shrink-0 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2 pointer-events-none">
            {initialData ? t('modal_edit_master', { id: initialData.id }) : t('modal_add_status')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-8 pt-6 flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_id')} <span className="text-red-500">*</span></label>
              <input type="number" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} placeholder={t('modal_id_req')} disabled={initialData !== null} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100`} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_type')} <span className="text-red-500">*</span></label>
              <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500`}>
                <option value="ENTITY">ENTITY (10~99)</option>
                <option value="OBJECT">OBJECT (100~199)</option>
                <option value="TRANSACTION">TRANSACTION (200~299)</option>
                <option value="WORKFLOW">WORKFLOW (300~399)</option>
                <option value="SYSTEM">SYSTEM (0~9)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_status_name')} <span className="text-red-500">*</span></label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-emerald-500`} />
          </div>

          <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <input type="checkbox" id="isActiveSwitch" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-gray-800 rounded focus:ring-gray-500 cursor-pointer" />
            <label htmlFor="isActiveSwitch" className="text-sm font-bold text-gray-700 cursor-pointer">{t('modal_status_active')}</label>
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

          {initialData && (
            <div className="mt-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex gap-4 text-xs font-medium text-gray-400">
                <span><strong className="text-gray-500">{t('modal_created_at')}</strong> {formatDateTime(formData.ne_ts)}</span>
                <span><strong className="text-gray-500">{t('modal_updated_at')}</strong> {formatDateTime(formData.up_ts)}</span>
              </div>
              {Number(initialData.id) >= 10 && (
                <button onClick={() => onDelete(Number(initialData.id))} disabled={isDeletePending} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1.5 rounded transition-colors flex items-center gap-1 disabled:opacity-50">
                  {isDeletePending ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>} {t('modal_logical_del')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-200 transition-colors">{tCommon('cancel')}</button>
          <button onClick={handleSaveClick} disabled={isPending} className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 shadow-md">
            {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  );
}