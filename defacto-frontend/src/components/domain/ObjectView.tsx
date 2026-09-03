'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { Search, Plus, Trash2, Download, UploadCloud, XCircle, ChevronLeft, ChevronRight, RefreshCw, X, AlertCircle, Database, Save, Box } from 'lucide-react';
import { getObjects, createObject, updateObject, deleteBulkObjects, getObjectTypes, bulkUpsertObjects, getStatusOptions } from '@/lib/api/master';
import DomainSearchConditions, { SearchCondition } from './DomainSearchConditions';
import DomainDataTable from './DomainDataTable';
import BulkPreviewModal from './BulkPreviewModal';
import DomainEditModal from './DomainEditModal';

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, 5];
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total];
  return [current - 2, current - 1, current, current + 1, current + 2];
};

export default function ObjectView() {
  const t = useTranslations('Domain');
  const tCommon = useTranslations('Common');
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

  const { data: objectTypesData } = useQuery({ queryKey: ['objectTypes'], queryFn: getObjectTypes });
  const { data: statusOptionsData } = useQuery({ queryKey: ['statusOptions', 'OBJECT'], queryFn: () => getStatusOptions('OBJECT') });
  const { data: objectsData, isLoading } = useQuery({ queryKey: ['objects', page, limit, typeFilter, appliedConditions], queryFn: () => getObjects(page, limit, typeFilter, appliedConditions) });

  const handleSuccess = (msg: string) => { alert(msg); setIsModalOpen(false); setIsPreviewOpen(false); queryClient.invalidateQueries({ queryKey: ['objects'] }); queryClient.invalidateQueries({ queryKey: ['objectTypes'] }); };
  const handleError = (err: any) => alert(err.response?.data?.detail || "Error");

  const createMut = useMutation({ mutationFn: createObject, onSuccess: () => handleSuccess(t('alert_save_success')), onError: handleError });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number, data: any }) => updateObject(id, data), onSuccess: () => handleSuccess(t('alert_update_success')), onError: handleError });
  const bulkDeleteMut = useMutation({ mutationFn: deleteBulkObjects, onSuccess: () => { handleSuccess(t('alert_bulk_del_success')); setSelectedIds([]); }, onError: handleError });
  const bulkUpsertMut = useMutation({ mutationFn: bulkUpsertObjects, onSuccess: () => handleSuccess(t('alert_bulk_upsert_success')), onError: handleError });

  const currentFilterTypes = objectTypesData?.data || [];
  const currentMeta = objectsData?.meta;
  const currentDataList = objectsData?.data || [];

  const toggleSelectAll = () => setSelectedIds(selectedIds.length === currentDataList.length && currentDataList.length > 0 ? [] : currentDataList.map((i: any) => i.object_id));
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleExport = () => {
    if (selectedIds.length === 0) return;
    const selectedData = currentDataList.filter((item: any) => selectedIds.includes(item.object_id));
    const allAttrKeys = new Set<string>();
    selectedData.forEach((item: any) => { if (item.attributes) Object.keys(item.attributes).forEach(k => allAttrKeys.add(k)); });
    const flatData = selectedData.map((item: any) => {
      const baseObj: any = { ID: item.object_id, TYPE: item.object_type, NAME: item.object_name, PARENT: item.parent_object_id || '', CREATED_AT: item.ne_ts || '', UPDATED_AT: item.up_ts || '' };
      allAttrKeys.forEach(key => { baseObj[key] = (item.attributes && item.attributes[key]) ? item.attributes[key] : ''; });
      return baseObj;
    });
    const blob = new Blob(["\uFEFF" + Papa.unparse(flatData)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `defacto_object_export.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (results) => {
        let errCount = 0;
        const parsed = results.data.map((row: any, index: number) => {
          const type = row.TYPE?.trim(); const name = row.NAME?.trim(); if (!type || !name) errCount++;
          const attrs: any = {}; Object.keys(row).forEach(key => { const upper = key.trim().toUpperCase(); if (!['ID','TYPE','NAME','PARENT','CREATED_AT','UPDATED_AT'].includes(upper) && row[key]) attrs[key.trim()] = row[key].trim(); });
          return { index: index + 1, id: row.ID ? Number(row.ID) : null, type, name, parent_id: row.PARENT ? Number(row.PARENT) : null, attributes: attrs, hasError: !type || !name };
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
                <option value="ALL">{t('filter_all_types')}</option>{currentFilterTypes.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {(typeFilter !== 'ALL' || appliedConditions.length > 0) && <div className="pt-7"><button onClick={() => { setTypeFilter('ALL'); setConditions([{ id: Date.now(), target: 'NAME', keyword: '', operator: 'AND' }]); setAppliedConditions([]); }} className="px-4 h-10 text-red-500 hover:bg-red-50 rounded-lg font-bold text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> {t('filter_reset')}</button></div>}
          </div>
          <div className="flex items-center gap-3 mt-7">
            {selectedIds.length === 0 ? (
              <>
                <input type="file" ref={fileInputRef} accept=".csv, .tsv" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 hover:bg-emerald-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1.5"><UploadCloud className="w-4 h-4" /> {t('btn_upload')}</button>
                <button onClick={() => { setEditModalData(null); setIsModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 transition-colors text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-md flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t('btn_register')}</button>
              </>
            ) : (
              <>
                <button onClick={handleExport} className="bg-gray-800 text-white px-4 py-1.5 h-10 rounded-lg text-sm font-bold shadow-sm flex items-center gap-1.5 hover:bg-black transition-colors"><Download className="w-4 h-4" /> {t('btn_export', { count: selectedIds.length })}</button>
                <button onClick={() => confirm(t('confirm_bulk_delete')) && bulkDeleteMut.mutate(selectedIds)} disabled={bulkDeleteMut.isPending} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 h-10 rounded-lg font-bold shadow-sm hover:bg-red-100 transition-colors flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> {t('btn_delete', { count: selectedIds.length })}</button>
              </>
            )}
          </div>
        </div>
        
        <DomainSearchConditions activeTab="OBJECT" conditions={conditions} setConditions={setConditions} onSearch={() => {setPage(1); setAppliedConditions([...conditions]);}} />
      </div>

      <div className="w-full overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
        <DomainDataTable 
           activeTab="OBJECT" isLoading={isLoading} currentDataList={currentDataList}
           selectedIds={selectedIds} toggleSelectAll={toggleSelectAll} toggleSelect={toggleSelect}
           openEditModal={(row: any) => {
              const aliases = Array.isArray(row.attributes?.aliases) ? row.attributes.aliases.join(', ') : '';
              const attrs = Object.entries(row.attributes || {}).filter(([k]) => k !== 'aliases').map(([k, v]) => ({ key: k, value: String(v) }));
              setEditModalData({ id: row.object_id, name: row.object_name, type: row.object_type, parent_id: row.parent_object_id || '', status_id: row.object_status_id || 1, aliases, attributes: attrs, ne_ts: row.ne_ts, up_ts: row.up_ts });
              setIsModalOpen(true);
           }}
        />
      </div>

      {currentMeta && (
        <div className="p-4 mt-6 border border-gray-200 bg-white shadow-sm rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500 pl-2">{t('total_count', { count: currentMeta.total_count })}</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <div className="flex gap-1">{getPageNumbers(page, currentMeta.total_pages).map(p => <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold ${page === p ? 'bg-emerald-600 text-white shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}>{p}</button>)}</div>
            <button disabled={page >= currentMeta.total_pages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-white border rounded-lg px-2 py-1.5 outline-none font-bold text-sm cursor-pointer shadow-sm text-gray-700">
             <option value={10}>{t('view_10')}</option>
             <option value={20}>{t('view_20')}</option>
             <option value={50}>{t('view_50')}</option>
          </select>
        </div>
      )}

      <BulkPreviewModal 
        activeTab="OBJECT"
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        previewData={previewData}
        previewErrors={previewErrors}
        onConfirm={() => { if(previewErrors === 0) bulkUpsertMut.mutate(previewData.map(item => ({ object_id: item.id, object_type: item.type.toUpperCase(), object_name: item.name, parent_object_id: item.parent_id, attributes: item.attributes }))); }}
        isPending={bulkUpsertMut.isPending}
      />

      <DomainEditModal
        activeTab="OBJECT"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editModalData}
        onSave={(data) => {
            const payload = { object_id: data.id ? Number(data.id) : null, object_name: data.name, object_type: data.type.toUpperCase(), parent_object_id: data.parent_id ? Number(data.parent_id) : null, object_status_id: data.status_id, attributes: data.finalAttributes };
            editModalData ? updateMut.mutate({ id: Number(data.id), data: payload }) : createMut.mutate(payload);
        }}
        isPending={createMut.isPending || updateMut.isPending}
        currentFilterTypes={currentFilterTypes}
        statusOptionsData={statusOptionsData}
      />
    </>
  );
}