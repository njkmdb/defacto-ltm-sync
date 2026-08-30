'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X, RefreshCw, FileText, AlertTriangle, Lightbulb, CheckSquare, Download, Database } from 'lucide-react';
import { generateEventBriefing, saveEventBriefing } from '@/lib/api/pipeline';
import { EventBriefingData } from '@/types/api';
import { handleBriefingExport } from '@/lib/utils/exportUtils';

interface EventBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMemoryIds: number[];
  queryText: string;
  baseEntityId: number;
  onSaveSuccess: () => void;
}

export default function EventBriefingModal({ isOpen, onClose, selectedMemoryIds, queryText, baseEntityId, onSaveSuccess }: EventBriefingModalProps) {
  const t = useTranslations('Memory');
  const [briefing, setBriefing] = useState<EventBriefingData | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [exportFormat, setExportFormat] = useState('TXT');

  const [execSummary, setExecSummary] = useState('');
  const [keyFindings, setKeyFindings] = useState('');
  const [risks, setRisks] = useState('');
  const [actions, setActions] = useState('');

  const generateMut = useMutation({
    mutationFn: async () => await generateEventBriefing({ query_text: queryText, selected_memory_ids: selectedMemoryIds, base_entity_id: baseEntityId }),
    onSuccess: (res) => {
      const data: EventBriefingData = res.data;
      setBriefing(data);
      setExecSummary(data.executive_summary);
      setKeyFindings(data.key_findings.join('\n- '));
      setRisks(data.risk_and_warnings.join('\n- '));
      setActions(data.recommended_actions.join('\n- '));
      setIsDisclaimerChecked(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || t('alert_gen_failed'));
      onClose();
    }
  });

  useEffect(() => {
    if (isOpen && selectedMemoryIds.length > 0) {
      setBriefing(null);
      generateMut.mutate();
    }
  }, [isOpen, selectedMemoryIds]);

  const handleDownload = () => {
    if (!isDisclaimerChecked) return;
    handleBriefingExport(
      exportFormat,
      { baseEntityId, queryText, execSummary, keyFindings, risks, actions, selectedMemoryIds },
      () => { onSaveSuccess(); onClose(); }
    );
  };

  const saveToArchiveMut = useMutation({
    mutationFn: async () => await saveEventBriefing({
      base_entity_id: baseEntityId,
      query_text: queryText,
      executive_summary: execSummary,
      key_findings: keyFindings.split('\n- ').filter(Boolean),
      risk_and_warnings: risks.split('\n- ').filter(Boolean),
      recommended_actions: actions.split('\n- ').filter(Boolean),
      source_memory_ids: selectedMemoryIds
    }),
    onSuccess: (data) => {
      alert(data.message || t('alert_save_success'));
      onSaveSuccess();
      onClose();
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_save_failed'))
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl w-[900px] max-w-full max-h-full flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-gray-900 p-5 flex items-center justify-between shrink-0">
          <div className="text-white">
            <h2 className="text-xl font-extrabold flex items-center gap-2"><FileText className="w-5 h-5 text-purple-400" /> {t('modal_title')}</h2>
            <p className="text-xs text-gray-400 mt-1">{t('modal_subtitle', { count: selectedMemoryIds.length })}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
          {generateMut.isPending ? (
            <div className="py-32 flex flex-col items-center justify-center text-gray-500">
              <RefreshCw className="w-12 h-12 animate-spin mb-4 text-purple-500" />
              <p className="font-bold">{t('modal_loading_1')}</p>
              <p className="text-xs mt-2 text-gray-400">{t('modal_loading_2')}</p>
            </div>
          ) : briefing ? (
            <>
              <div>
                <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-blue-500"/> {t('modal_exec_summary')}</label>
                <textarea value={execSummary} onChange={e => setExecSummary(e.target.value)} className="w-full h-24 p-3 border border-gray-300 rounded-lg text-sm text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white resize-none" />
              </div>
              <div>
                <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-emerald-500"/> {t('modal_key_findings')}</label>
                <textarea value={keyFindings} onChange={e => setKeyFindings(e.target.value)} className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white resize-none leading-relaxed" />
              </div>
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <label className="text-sm font-extrabold text-red-800 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> {t('modal_risks')}</label>
                <textarea value={risks} onChange={e => setRisks(e.target.value)} className="w-full h-24 p-3 border border-red-300 rounded-lg text-sm text-red-800 bg-white outline-none focus:ring-2 focus:ring-red-400 resize-none font-medium" />
              </div>
              <div>
                <label className="text-sm font-extrabold text-gray-800 mb-2 flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-500"/> {t('modal_actions')}</label>
                <textarea value={actions} onChange={e => setActions(e.target.value)} className="w-full h-24 p-3 border border-gray-300 rounded-lg text-sm text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white resize-none leading-relaxed" />
              </div>
            </>
          ) : null}
        </div>

        {!generateMut.isPending && briefing && (
          <div className="bg-gray-100 p-5 border-t border-gray-200 shrink-0 flex flex-col gap-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={isDisclaimerChecked} onChange={(e) => setIsDisclaimerChecked(e.target.checked)} className="mt-1 w-5 h-5 text-purple-600 rounded cursor-pointer" />
              <span className="text-sm font-bold text-gray-700 leading-tight"><span className="text-red-500">{t('modal_disclaimer_mark')}</span>{t('modal_disclaimer')}</span>
            </label>
            <div className="flex justify-end gap-3 items-center">
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className="bg-white border border-gray-300 text-gray-700 font-bold text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer shadow-sm">
                <option value="TXT">{t('modal_opt_txt')}</option>
                <option value="MD">{t('modal_opt_md')}</option>
                <option value="JSON">{t('modal_opt_json')}</option>
                <option value="WORD">{t('modal_opt_doc')}</option>
                <option value="PDF">{t('modal_opt_pdf')}</option>
              </select>
              <button onClick={handleDownload} disabled={!isDisclaimerChecked} className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"><Download className="w-5 h-5" /> {t('modal_btn_download')}</button>
              <button onClick={() => saveToArchiveMut.mutate()} disabled={!isDisclaimerChecked || saveToArchiveMut.isPending} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                {saveToArchiveMut.isPending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />} {t('modal_btn_save')}
              </button>
              <button onClick={onClose} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors ml-2">{t('modal_btn_cancel')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}