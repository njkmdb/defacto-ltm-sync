'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { Search, Plus, Trash2, UploadCloud, XCircle, ChevronLeft, ChevronRight, RefreshCw, X, AlertCircle, Database, Save, Tags, Lock } from 'lucide-react';
import { getStatuses, createStatus, updateStatus, deleteStatus, deleteBulkStatuses, bulkUpsertStatuses } from '@/lib/api/master';
import DomainSearchConditions, { SearchCondition } from './DomainSearchConditions';
import DomainDataTable from './DomainDataTable';
import BulkPreviewModal from './BulkPreviewModal';
import StatusEditModal from './StatusEditModal';

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function StatusView() {
  const t = useTranslations('Domain');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [conditions, setConditions] = useState<SearchCondition[]>([{ id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }]);
  const [appliedConditions, setAppliedConditions] = useState<SearchCondition[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editModalData, setEditModalData] = useState<any | null>(null);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewErrors, setPreviewErrors] = useState(0);

  const currentFilterTypes = ['SYSTEM', 'ENTITY', 'OBJECT', 'TRANSACTION', 'WORKFLOW'];
  const { data: statusesData, isLoading } = useQuery({ queryKey: ['statuses', page, limit, typeFilter, appliedConditions], queryFn: () => getStatuses(page, limit, typeFilter, appliedConditions) });

  const handleSuccess = (msg: string) => { alert(msg); setIsModalOpen(false); setIsPreviewOpen(false); queryClient.invalidateQueries({ queryKey: ['statuses'] }); queryClient.invalidateQueries({ queryKey: ['statusOptions'] }); };
  const handleError = (err: any) => alert(err.response?.data?.detail || "Error");

  const createMut = useMutation({ mutationFn: createStatus, onSuccess: () => handleSuccess(t('alert_save_success')), onError: handleError });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number, data: any }) => updateStatus(id, data), onSuccess: () => handleSuccess(t('alert_update_success')), onError: handleError });
  const deleteMut = useMutation({ mutationFn: deleteStatus, onSuccess: () => { handleSuccess(t('alert_del_success')); setEditModalData(null); setIsModalOpen(false); }, onError: handleError });
  const bulkDeleteMut = useMutation({ mutationFn: deleteBulkStatuses, onSuccess: () => { handleSuccess(t('alert_bulk_del_success')); setSelectedIds([]); }, onError: handleError });
  const bulkUpsertMut = useMutation({ mutationFn: bulkUpsertStatuses, onSuccess: () => handleSuccess(t('alert_bulk_upsert_success')), onError: handleError });

  const currentMeta = statusesData?.meta;
  const currentDataList = statusesData?.data || [];

  const toggleSelectAll = () => {
    const selectable = currentDataList.filter((i: any) => i.status_id >= 10).map((i: any) => i.status_id);
    setSelectedIds(selectedIds.length === selectable.length && selectable.length > 0 ? [] : selectable);
  };
  const toggleSelect = (id: number) => { if (id >= 10) setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        let errCount = 0;
        const parsed = results.data.map((row: any, index: number) => {
          const type = row.CATEGORY?.trim(); const name = row.NAME?.trim(); const id = row.ID ? Number(row.ID) : null;
          const isActive = row.IS_ACTIVE?.toUpperCase() !== 'FALSE';
          
          const attrs: any = {}; Object.keys(row).forEach(key => { const upper = key.trim().toUpperCase(); if (!['ID','CATEGORY','NAME','IS_ACTIVE','CREATED_AT','UPDATED_AT'].includes(upper) && row[key]) attrs[key.trim()] = row[key].trim(); });
          
          if (!type || !name || !id) errCount++;
          return { index: index + 1, id, type, name, attributes: attrs, is_active: isActive, hasError: !type || !name || !id };
        });
        setPreviewData(parsed); setPreviewErrors(errCount); setIsPreviewOpen(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-col gap-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Search className="w-4 h-4"/> {t('filter_quick')}</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 h-10 outline-none">
                <option value="ALL">{t('filter_all_categories')}</option>{currentFilterTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(typeFilter !== 'ALL' || appliedConditions.length > 0) && <div className="pt-7"><button onClick={() => { setTypeFilter('ALL'); setConditions([{ id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }]); setAppliedConditions([]); }} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> {t('filter_reset')}</button></div>}
          </div>
          <div className="flex items-center gap-3 mt-7">
            {selectedIds.length === 0 ? (
              <><input type="file" ref={fileInputRef} accept=".csv, .tsv" onChange={handleFileUpload} className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1.5"><UploadCloud className="w-4 h-4" /> {t('btn_upload')}</button><button onClick={() => { setEditModalData(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-md flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('btn_register')}</button></>
            ) : (
              <><button onClick={() => confirm(t('confirm_bulk_delete')) && bulkDeleteMut.mutate(selectedIds)} disabled={bulkDeleteMut.isPending} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold shadow-sm hover:bg-red-100 transition-colors flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> {t('btn_delete', { count: selectedIds.length })}</button></>
            )}
          </div>
        </div>
        
        <DomainSearchConditions activeTab="STATUS" conditions={conditions} setConditions={setConditions} onSearch={() => {setPage(1); setAppliedConditions([...conditions]);}} />
      </div>

      <div className="w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
        <DomainDataTable 
           activeTab="STATUS" isLoading={isLoading} currentDataList={currentDataList}
           selectedIds={selectedIds} toggleSelectAll={toggleSelectAll} toggleSelect={toggleSelect}
           openEditModal={(row: any) => {
              const attrs = Object.entries(row.attributes || {}).map(([k, v]) => ({ key: k, value: String(v) }));
              setEditModalData({ id: row.status_id, name: row.status_name, type: row.domain_category, attributes: attrs, is_active: row.is_active, ne_ts: row.ne_ts, up_ts: row.up_ts });
              setIsModalOpen(true);
           }}
        />
      </div>

      {currentMeta && (
        <div className="p-4 mt-6 border border-gray-200 bg-white shadow-sm rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500 pl-2">{t('total_count', { count: currentMeta.total_count })}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex gap-1">{getPageNumbers(page, currentMeta.total_pages).map(p => <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold ${page === p ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}>{p}</button>)}</div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border rounded-lg px-2 py-1.5 outline-none font-bold text-sm cursor-pointer shadow-sm text-gray-700">
             <option value={10}>{t('view_10')}</option>
             <option value={20}>{t('view_20')}</option>
             <option value={50}>{t('view_50')}</option>
          </select>
        </div>
      )}

      <BulkPreviewModal 
        activeTab="STATUS"
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        previewData={previewData}
        previewErrors={previewErrors}
        onConfirm={() => { if(previewErrors === 0) bulkUpsertMut.mutate(previewData.map(item => ({ status_id: item.id, domain_category: item.type.toUpperCase(), status_name: item.name, attributes: item.attributes, is_active: item.is_active }))); }}
        isPending={bulkUpsertMut.isPending}
      />

      <StatusEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editModalData}
        onSave={(data) => {
            const payload = { status_id: Number(data.id), domain_category: data.type.toUpperCase(), status_name: data.name, attributes: data.finalAttributes, is_active: data.is_active };
            editModalData ? updateMut.mutate({ id: Number(data.id), data: payload }) : createMut.mutate(payload);
        }}
        isPending={createMut.isPending || updateMut.isPending}
        onDelete={(id) => { if(confirm(t('modal_confirm_del'))) deleteMut.mutate(id); }}
        isDeletePending={deleteMut.isPending}
      />
    </>
  );
}