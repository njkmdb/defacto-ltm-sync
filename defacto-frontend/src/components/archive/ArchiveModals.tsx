'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, X, AlertCircle, Database, ListTodo, Plus, RefreshCw, Save } from 'lucide-react';

interface ArchiveModalsProps {
  isPreviewOpen: boolean;
  setIsPreviewOpen: (v: boolean) => void;
  previewData: any[];
  previewErrors: number;
  handleBulkUpsertConfirm: () => void;
  isBulkPending: boolean;

  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  selectedLogId: number | null;
  formData: any;
  setFormData: (v: any) => void;
  handleSave: () => void;
  isSavePending: boolean;
}

export default function ArchiveModals({
  isPreviewOpen, setIsPreviewOpen, previewData, previewErrors, handleBulkUpsertConfirm, isBulkPending,
  isModalOpen, setIsModalOpen, selectedLogId, formData, setFormData, handleSave, isSavePending
}: ArchiveModalsProps) {
  const t = useTranslations('Archive');

  // --- Preview Modal Drag State ---
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const previewDragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (!isPreviewOpen) setPreviewPos({ x: 0, y: 0 });
  }, [isPreviewOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPreviewDragging) return;
      setPreviewPos({
        x: previewDragStart.current.posX + (e.clientX - previewDragStart.current.x),
        y: previewDragStart.current.posY + (e.clientY - previewDragStart.current.y)
      });
    };
    const handleMouseUp = () => { if (isPreviewDragging) setIsPreviewDragging(false); };
    if (isPreviewDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPreviewDragging]);

  const handlePreviewMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsPreviewDragging(true);
    previewDragStart.current = { x: e.clientX, y: e.clientY, posX: previewPos.x, posY: previewPos.y };
  };

  // --- Edit/Create Modal Drag State ---
  const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
  const [isModalDragging, setIsModalDragging] = useState(false);
  const modalDragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    if (!isModalOpen) setModalPos({ x: 0, y: 0 });
  }, [isModalOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isModalDragging) return;
      setModalPos({
        x: modalDragStart.current.posX + (e.clientX - modalDragStart.current.x),
        y: modalDragStart.current.posY + (e.clientY - modalDragStart.current.y)
      });
    };
    const handleMouseUp = () => { if (isModalDragging) setIsModalDragging(false); };
    if (isModalDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isModalDragging]);

  const handleModalMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsModalDragging(true);
    modalDragStart.current = { x: e.clientX, y: e.clientY, posX: modalPos.x, posY: modalPos.y };
  };

  return (
    <>
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div 
            className="bg-white rounded-2xl flex flex-col shadow-2xl border border-gray-100 overflow-hidden relative"
            style={{
              transform: `translate(${previewPos.x}px, ${previewPos.y}px)`,
              width: '1200px',
              minWidth: '600px',
              minHeight: '400px',
              maxHeight: '90vh',
              resize: 'both'
            }}
          >
            <div 
              className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/50 shrink-0 cursor-move select-none"
              onMouseDown={handlePreviewMouseDown}
            >
              <div className="pointer-events-none">
                <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                  <UploadCloud className="w-6 h-6 text-blue-600" /> {t('preview_title_log')}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{t('preview_desc', { count: previewData.length })}</p>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded transition-colors cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
              {previewErrors > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm font-bold">
                  <AlertCircle className="w-5 h-5" /> {t('preview_err_log', { count: previewErrors })}
                </div>
              )}
              <table className="w-full text-left border-collapse bg-white shadow-sm rounded-lg overflow-hidden text-sm whitespace-nowrap">
                <thead className="bg-gray-100 border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-3 w-16 text-center">{t('preview_col_row')}</th>
                    <th className="p-3 w-20">{t('col_log_id')}</th>
                    <th className="p-3 w-28">{t('col_entity_id')} <span className="text-red-500">*</span></th>
                    <th className="p-3 w-32">{t('col_date')} <span className="text-red-500">*</span></th>
                    <th className="p-3 min-w-[300px]">{t('col_summary')} <span className="text-red-500">*</span></th>
                    <th className="p-3 w-32">{t('col_action_items')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewData.map((row, i) => (
                    <tr key={i} className={row.hasError ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                      <td className="p-3 text-center text-gray-400 font-bold">{row.index}</td>
                      <td className="p-3 font-semibold text-gray-700">{row.log_id || <span className="text-blue-400 text-[10px] bg-blue-50 px-1 rounded">자동발급</span>}</td>
                      <td className="p-3 font-bold text-gray-800">{row.base_entity_id || <span className="text-red-500">누락됨</span>}</td>
                      <td className="p-3">{row.log_date || <span className="text-red-500 font-bold">누락됨</span>}</td>
                      <td className="p-3 text-xs text-gray-600 truncate max-w-[400px]">{row.llm_summary || <span className="text-red-500 font-bold">누락됨</span>}</td>
                      <td className="p-3 text-xs text-purple-600 font-bold">{row.action_items.length > 0 ? `${row.action_items.length} Tasks` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-white shrink-0">
              <button onClick={() => setIsPreviewOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors">{t('preview_cancel')}</button>
              <button onClick={handleBulkUpsertConfirm} disabled={previewErrors > 0 || isBulkPending} className="flex items-center gap-2 text-white px-8 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-md">
                {isBulkPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />} {t('preview_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white rounded-2xl flex flex-col shadow-2xl border border-gray-100 relative"
            style={{
              transform: `translate(${modalPos.x}px, ${modalPos.y}px)`,
              width: '800px',
              minWidth: '400px',
              minHeight: '400px',
              maxHeight: '90vh',
              resize: 'both',
              overflow: 'hidden'
            }}
          >
            <div 
              className="px-8 py-6 flex items-center justify-between border-b border-gray-100 shrink-0 cursor-move select-none"
              onMouseDown={handleModalMouseDown}
            >
              <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2 pointer-events-none">
                {selectedLogId ? t('modal_edit_title', { id: selectedLogId }) : t('modal_create_title')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_entity_id')} <span className="text-red-500">*</span></label>
                  <input type="number" value={formData.base_entity_id} onChange={(e) => setFormData({...formData, base_entity_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_log_date')} <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.log_date} onChange={(e) => setFormData({...formData, log_date: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_summary_title')} <span className="text-red-500">*</span></label>
                <textarea value={formData.llm_summary} onChange={(e) => setFormData({...formData, llm_summary: e.target.value})} className="w-full h-40 border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed" placeholder={t('modal_summary_placeholder')} />
              </div>

              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-extrabold text-gray-700 flex items-center gap-2"><ListTodo className="w-4 h-4 text-indigo-500" /> {t('modal_action_title')}</h3>
                  <button onClick={() => setFormData({...formData, action_items: [...formData.action_items, {task: '', due_date: ''}]})} className="text-xs font-bold bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 px-2 py-1 rounded transition-colors flex items-center gap-1"><Plus className="w-3 h-3" /> {t('modal_action_add')}</button>
                </div>
                <div className="space-y-3">
                  {formData.action_items.length === 0 && <p className="text-xs text-gray-400 font-bold">{t('modal_action_empty')}</p>}
                  {formData.action_items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                      <input type="date" value={item.due_date} onChange={(e) => { const newItems = [...formData.action_items]; newItems[idx].due_date = e.target.value; setFormData({...formData, action_items: newItems}); }} className="w-36 border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-indigo-400 text-gray-600 font-bold" />
                      <input type="text" placeholder={t('modal_action_desc')} value={item.task} onChange={(e) => { const newItems = [...formData.action_items]; newItems[idx].task = e.target.value; setFormData({...formData, action_items: newItems}); }} className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-indigo-400" />
                      <button onClick={() => { const newItems = [...formData.action_items]; newItems.splice(idx, 1); setFormData({...formData, action_items: newItems}); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">{t('modal_cancel')}</button>
              <button onClick={handleSave} disabled={isSavePending} className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700 shadow-md">
                {isSavePending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('modal_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}