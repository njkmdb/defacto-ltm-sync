'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, X, AlertCircle, Database, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import useLocaleFormatter from '@/hooks/useLocaleFormatter';

interface DomainModalsProps {
  activeTab: 'ENTITY' | 'OBJECT' | 'STATUS';
  isPreviewOpen: boolean;
  setIsPreviewOpen: (v: boolean) => void;
  previewData: any[];
  previewErrors: number;
  handleBulkUpsertConfirm: () => void;
  isPending: boolean;
  
  isModalOpen: boolean;
  setIsModalOpen: (v: boolean) => void;
  selectedId: number | null;
  formData: any;
  setFormData: (v: any) => void;
  handleSave: () => void;
  handleDeleteStatus: () => void;
  deleteStatusMutPending: boolean;
  currentFilterTypes: string[];
  statusOptionsData: any;
}

const formatAttributes = (attrs: Record<string, any>) => {
  if (!attrs || Object.keys(attrs).length === 0) return '-';
  return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join('  |  ');
};

export default function DomainModals({
  activeTab, isPreviewOpen, setIsPreviewOpen, previewData, previewErrors, handleBulkUpsertConfirm, isPending,
  isModalOpen, setIsModalOpen, selectedId, formData, setFormData, handleSave, handleDeleteStatus, deleteStatusMutPending, currentFilterTypes, statusOptionsData
}: DomainModalsProps) {

  const t = useTranslations('Domain');
  const tCommon = useTranslations('Common');
  const { formatDateTime } = useLocaleFormatter();

  return (
    <>
      {/* 미리보기 모달 */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl w-[1200px] max-w-[95vw] h-[85vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50/50">
              <div>
                <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                  <UploadCloud className="w-6 h-6 text-blue-600" /> {t('preview_title', { type: activeTab })}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{t('preview_desc', { count: previewData.length })}</p>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:bg-gray-100 p-2 rounded transition-colors"><X className="w-6 h-6" /></button>
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
              <button onClick={() => setIsPreviewOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors">{t('preview_cancel')}</button>
              <button onClick={handleBulkUpsertConfirm} disabled={previewErrors > 0 || isPending} className="flex items-center gap-2 text-white px-8 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 shadow-md">
                {isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />} {t('preview_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 생성 및 편집 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                {selectedId ? t('modal_edit_master', { id: selectedId }) : activeTab === 'STATUS' ? t('modal_add_status') : t('modal_add_master')}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_id')} {activeTab === 'STATUS' ? <span className="text-red-500">*</span> : <span className="font-normal text-xs text-gray-400">{t('modal_id_opt')}</span>}</label>
                  <input type="number" value={formData.id} onChange={(e) => setFormData({...formData, id: e.target.value})} placeholder={activeTab === 'STATUS' ? t('modal_id_req') : t('modal_id_auto')} disabled={activeTab === 'STATUS' && selectedId !== null} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100`} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_type')} <span className="text-red-500">*</span></label>
                  {activeTab === 'STATUS' ? (
                    <select value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500`}>
                      <option value="ENTITY">ENTITY (10~99)</option>
                      <option value="OBJECT">OBJECT (100~199)</option>
                      <option value="TRANSACTION">TRANSACTION (200~299)</option>
                      <option value="WORKFLOW">WORKFLOW (300~399)</option>
                    </select>
                  ) : (
                    <>
                      <input type="text" list="type-options" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value.toUpperCase()})} placeholder={t('modal_type_placeholder')} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 uppercase focus:ring-emerald-500`} />
                      <datalist id="type-options">{currentFilterTypes.map((t: string) => <option key={t} value={t} />)}</datalist>
                    </>
                  )}
                </div>
                {activeTab !== 'STATUS' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('modal_parent')}</label>
                    <input type="number" value={formData.parent_id} onChange={(e) => setFormData({...formData, parent_id: e.target.value})} placeholder="e.g. 1" className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500`} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{activeTab === 'STATUS' ? t('modal_status_name') : t('modal_name')} <span className="text-red-500">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-base font-bold outline-none focus:ring-2 focus:ring-emerald-500`} />
              </div>

              {activeTab !== 'STATUS' && (
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                   <label className="block text-sm font-bold text-emerald-800 mb-2">{t('modal_biz_status')}</label>
                   <select value={formData.status_id} onChange={(e) => setFormData({...formData, status_id: Number(e.target.value)})} className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-400">
                      {statusOptionsData?.data?.map((s: any) => <option key={s.status_id} value={s.status_id}>ID: {s.status_id} - {s.status_name}</option>)}
                      {(!statusOptionsData?.data?.some((s:any) => s.status_id === 1)) && <option value={1}>ID: 1 - SYNCED</option>}
                   </select>
                </div>
              )}

              {activeTab !== 'STATUS' && (
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
              )}

              {activeTab === 'STATUS' ? (
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input type="checkbox" id="isActiveSwitch" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-gray-800 rounded focus:ring-gray-500 cursor-pointer" />
                  <label htmlFor="isActiveSwitch" className="text-sm font-bold text-gray-700 cursor-pointer">{t('modal_status_active')}</label>
                </div>
              ) : (
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
              )}
            </div>

            {selectedId && (
              <div className="mt-6 flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex gap-4 text-xs font-medium text-gray-400">
                  <span><strong className="text-gray-500">{t('modal_created_at')}</strong> {formatDateTime(formData.ne_ts)}</span>
                  <span><strong className="text-gray-500">{t('modal_updated_at')}</strong> {formatDateTime(formData.up_ts)}</span>
                </div>
                {activeTab === 'STATUS' && selectedId >= 10 && (
                  <button onClick={handleDeleteStatus} disabled={deleteStatusMutPending} className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1.5 rounded transition-colors flex items-center gap-1 disabled:opacity-50">
                    {deleteStatusMutPending ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>} {t('modal_logical_del')}
                  </button>
                )}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-200 transition-colors">{tCommon('cancel')}</button>
              <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700 shadow-md">
                {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {tCommon('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}