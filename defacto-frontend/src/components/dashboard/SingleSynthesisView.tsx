'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { FileText, Calendar, User, Save, ListTodo, CheckCircle, RefreshCw, Flame, Layers, AlertTriangle } from 'lucide-react';
import { 
  updateRawEvent,
  getRawEventStatus,
  getRawEventDetail,
  executeDynamicPipeline,
  getPipelinePresets
} from '@/lib/api/pipeline';
import { saveContextSummary } from '@/lib/api/archive';
import { DiscrepancyItem } from '@/types/api';

export default function SingleSynthesisView() {
  const t = useTranslations('Dashboard');
  const queryClient = useQueryClient();
  const [entityId, setEntityId] = useState<number>(1024);
  const [refDate, setRefDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [useDeepSearch, setUseDeepSearch] = useState<boolean>(false);
  const [usePreFactCheck, setUsePreFactCheck] = useState<boolean>(true);
  
  const [isCheckingFact, setIsCheckingFact] = useState<boolean>(false);
  const [isAutoCorrecting, setIsAutoCorrecting] = useState<boolean>(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflicts, setConflicts] = useState<DiscrepancyItem[]>([]);

  const [synthData, setSynthData] = useState<any>(null);
  const [editableSummary, setEditableSummary] = useState<string>('');
  const [currentLogId, setCurrentLogId] = useState<number | undefined>(undefined);

  const { data: presets } = useQuery({
    queryKey: ['pipelinePresets'],
    queryFn: () => getPipelinePresets(1, 50, true)
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('default_synthesis_v1');

  const synthMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPresetId) throw new Error(t('synth_alert_preset_req'));
      return await executeDynamicPipeline({
        pipeline_id: selectedPresetId,
        base_entity_id: entityId,
        initial_context: { 
          reference_date: refDate, 
          use_deep_search: useDeepSearch,
          use_pre_fact_check: usePreFactCheck,
          query_text: "최근 발생한 중요 이벤트 및 비즈니스 활동 이력 검색" 
        },
        steps: [] 
      });
    },
    onSuccess: (res) => {
      setIsCheckingFact(false);
      const finalState = res.final_state;
      let foundSummary = "";
      let foundActions = [];
      let foundLogId = undefined;
      
      for (const key in finalState) {
        if (finalState[key] && typeof finalState[key] === 'object') {
          if (finalState[key].llm_summary) foundSummary = finalState[key].llm_summary;
          if (finalState[key].action_items) foundActions = finalState[key].action_items;
          if (finalState[key].inserted_id) foundLogId = finalState[key].inserted_id;
        }
      }
      
      setSynthData({ finalState, summary: foundSummary, actions: foundActions });
      setEditableSummary(foundSummary);
      setCurrentLogId(foundLogId);
    },
    onError: (err: any) => {
      setIsCheckingFact(false);
      const detail = err.response?.data?.detail;
      if (detail && detail.type === "FACT_CONFLICT") {
        setConflicts(detail.discrepancies);
        setIsConflictModalOpen(true);
      } else {
        alert(detail || err.message || t('synth_alert_fail'));
      }
    }
  });

  const triggerRollbackTestMut = useMutation({
    mutationFn: async () => {
      return await executeDynamicPipeline({
        base_entity_id: entityId,
        initial_context: { reference_date: refDate, trigger_qa_error: true },
        steps: [
          {
             step_id: "node_test_01",
             step_order: 1,
             module_name: "Persist_DB",
             params: {
               target_table: "event_logs",
               reference_date: "{{initial_context.reference_date}}",
               schema_name: "ContextSynthesisSchema",
               data: { llm_summary: "이 데이터는 롤백되어 DB에 남아있지 않아야 합니다.", action_items: [] }
             },
             output_key: "db_save_result"
          },
          {
             step_id: "node_test_02",
             step_order: 2,
             module_name: "Test_Error",
             params: { trigger_error: "{{initial_context.trigger_qa_error}}" },
             output_key: "error_result"
          }
        ]
      });
    },
    onSuccess: () => alert(t('synth_alert_qa_fail')),
    onError: (err: any) => alert(t('synth_alert_qa_success', { reason: err.response?.data?.detail || err.message }).replace(/\\n/g, '\n'))
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const actionItemsToSave = synthData?.actions || [];
      return await saveContextSummary(entityId, refDate, editableSummary, actionItemsToSave, currentLogId);
    },
    onSuccess: (data) => {
      alert(t('synth_alert_save_success', { message: data.message }));
      queryClient.invalidateQueries({ queryKey: ['eventLogs'] });
    },
    onError: () => alert(t('synth_alert_save_fail'))
  });

  const handleSynthesisGenerate = () => {
    setIsCheckingFact(true); 
    synthMutation.mutate(); 
  };

  const handleAutoCorrectionAndResume = async (discrepancy: DiscrepancyItem) => {
    const today = new Date().toISOString().split('T')[0];
    const auditTag = `\n\n[System Auto-Correction (${today}): ERP 데이터 대조 결과, ${discrepancy.issue_topic} 교정됨. AI 오답(${discrepancy.ai_memory_value}) -> 정답(${discrepancy.ext_truth_value})]`;
    
    try {
        setIsConflictModalOpen(false);
        setIsAutoCorrecting(true);
        
        let originalContent = `[${discrepancy.issue_topic} 관련 원본 활동 내역]`;
        try {
            const rawDetail = await getRawEventDetail(discrepancy.source_raw_id, entityId);
            if (rawDetail?.data?.raw_content) {
                originalContent = rawDetail.data.raw_content;
            }
        } catch (e) {
            console.warn(t('synth_alert_single_fail_fallback'));
        }
        
        await updateRawEvent(discrepancy.source_raw_id, {
           base_entity_id: entityId, 
           event_date: refDate, 
           raw_content: originalContent + auditTag, 
           run_pipeline_now: true, 
           schema_name: 'HierarchicalFactSchema' 
        });
        
        let isSynced = false;
        let attempts = 0;
        const maxAttempts = 30; 
        
        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                const statusRes = await getRawEventStatus(discrepancy.source_raw_id, entityId);
                
                if (statusRes.sync_status_id === 1) { 
                    clearInterval(pollInterval);
                    setIsAutoCorrecting(false);
                    isSynced = true;
                    alert(t('synth_alert_correct_success'));
                    synthMutation.mutate(); 
                } else if (statusRes.sync_status_id === 2) { 
                    clearInterval(pollInterval);
                    setIsAutoCorrecting(false);
                    isSynced = true;
                    alert(t('synth_alert_correct_fail', { error: statusRes.error_log }));
                }
            } catch(err) {
                console.warn("Polling 네트워크 에러 무시 후 재시도", err);
            }

            if (attempts >= maxAttempts && !isSynced) {
                clearInterval(pollInterval);
                setIsAutoCorrecting(false);
                alert(t('synth_alert_correct_timeout'));
            }
        }, 2000); 
        
    } catch(e: any) {
        setIsAutoCorrecting(false);
        alert(e.message || t('synth_alert_correct_err'));
    }
  };

  let metricsType = "DYNAMIC PIPELINE";
  if (synthData?.finalState) {
    for (const key in synthData.finalState) {
       if (synthData.finalState[key]?.rag_metrics) {
         metricsType = synthData.finalState[key].rag_metrics.memory_type_used || metricsType;
       }
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-end mb-4 -mt-2 shrink-0 h-6">
        {synthData && (
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full flex items-center gap-1 uppercase tracking-wider">
            <CheckCircle className="w-3 h-3" /> {metricsType}
          </span>
        )}
      </div>
      <div className="flex gap-4 mb-4 shrink-0">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><User className="w-4 h-4" /> {t('synth_base_entity')}</label>
          <input type="number" value={entityId} onChange={(e) => setEntityId(parseInt(e.target.value))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4" /> {t('synth_ref_date')}</label>
          <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Layers className="w-4 h-4" /> {t('synth_preset')}</label>
          <select value={selectedPresetId} onChange={e => setSelectedPresetId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-semibold text-gray-700">
            <option value="default_synthesis_v1">{t('synth_preset_default')}</option>
            {presets?.data?.filter((p: any) => p.pipeline_id !== 'default_synthesis_v1').map((p: any) => (
              <option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 mb-4 transition-colors hover:bg-emerald-50 shrink-0">
        <input
          type="checkbox"
          id="usePreFactCheck"
          checked={usePreFactCheck}
          onChange={e => setUsePreFactCheck(e.target.checked)}
          disabled={!!selectedPresetId && selectedPresetId !== 'default_synthesis_v1'}
          className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
        />
        <label htmlFor="usePreFactCheck" className={`text-sm font-bold cursor-pointer flex items-center gap-1.5 ${selectedPresetId && selectedPresetId !== 'default_synthesis_v1' ? 'text-gray-400' : 'text-emerald-800'}`}>
          {t('synth_check_pre_fact')} {selectedPresetId && selectedPresetId !== 'default_synthesis_v1' && t('synth_check_ignored')}
        </label>
      </div>

      <div className="flex items-center gap-3 bg-red-50/50 p-4 rounded-xl border border-red-100 mb-6 transition-colors hover:bg-red-50 shrink-0">
        <input
          type="checkbox"
          id="useDeepSearch"
          checked={useDeepSearch}
          onChange={e => setUseDeepSearch(e.target.checked)}
          disabled={!!selectedPresetId && selectedPresetId !== 'default_synthesis_v1'}
          className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer disabled:opacity-50"
        />
        <label htmlFor="useDeepSearch" className={`text-sm font-bold cursor-pointer flex items-center gap-1.5 ${selectedPresetId && selectedPresetId !== 'default_synthesis_v1' ? 'text-gray-400' : 'text-red-800'}`}>
          <Flame className="w-4 h-4" /> {t('synth_check_deep')} {selectedPresetId && selectedPresetId !== 'default_synthesis_v1' && t('synth_check_ignored')}
        </label>
      </div>

      <div className="flex gap-2 mb-6 shrink-0">
          <button onClick={handleSynthesisGenerate} disabled={synthMutation.isPending || isCheckingFact || isAutoCorrecting} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-md">
            {synthMutation.isPending || isCheckingFact || isAutoCorrecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />} 
            {isCheckingFact ? t('synth_btn_running') : isAutoCorrecting ? t('synth_btn_correcting') : t('synth_btn_run')}
          </button>
          
          <button onClick={() => triggerRollbackTestMut.mutate()} disabled={triggerRollbackTestMut.isPending} className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold border border-red-200 shadow-sm disabled:opacity-50 transition-colors flex flex-col items-center justify-center gap-0.5">
             {triggerRollbackTestMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <AlertTriangle className="w-4 h-4"/>}
             {t('synth_btn_qa')}
          </button>
      </div>

      {synthData ? (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
          <div className="flex flex-col">
            <label className="text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
              <span>{t('synth_label_summary')}</span>
              <button onClick={() => { if (!editableSummary.trim()) return alert(t('synth_alert_save_empty')); saveMutation.mutate(); }} disabled={saveMutation.isPending} className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50 border border-indigo-200">
                {saveMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t('synth_btn_save')}
              </button>
            </label>
            <textarea value={editableSummary} onChange={(e) => setEditableSummary(e.target.value)} className="w-full min-h-[250px] p-4 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-gray-800 bg-indigo-50/30 leading-relaxed resize-none shadow-inner" />
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <ListTodo className="w-4 h-4" /> {t('synth_label_actions')}
            </label>
            {synthData.actions?.length > 0 ? (
              <ul className="space-y-2 pb-4">
                {synthData.actions.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold rounded shrink-0">{item.due_date}</span>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{item.task}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 font-bold bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">{t('synth_empty_actions')}</p>
            )}
          </div>
        </div>
      ) : (
         <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
            <FileText className="w-16 h-16 mb-4" />
            <p className="font-bold text-lg">{t('synth_empty_title')}</p>
            <div className="text-sm mt-2" dangerouslySetInnerHTML={{ __html: t('synth_empty_desc') }} />
         </div>
      )}

      {isConflictModalOpen && conflicts.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
           <div className="bg-white p-8 rounded-2xl w-[700px] shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">{t('synth_modal_title')}</h3>
              <p className="text-sm text-gray-600 mb-6">{t('synth_modal_desc')}</p>
              
              <div className="max-h-64 overflow-y-auto space-y-4 mb-6 pr-2">
                {conflicts.map((c, i) => (
                   <div key={i} className="bg-gray-50 border border-gray-200 p-4 rounded-xl shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                         <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs border border-indigo-100">{c.issue_topic}</span>
                         <span className="text-[10px] text-gray-400 font-bold">Raw ID: {c.source_raw_id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                         <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                            <p className="text-xs font-bold text-red-500 mb-1">{t('synth_modal_ai')}</p>
                            <p className="font-medium text-red-800 leading-relaxed">{c.ai_memory_value}</p>
                         </div>
                         <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                            <p className="text-xs font-bold text-emerald-500 mb-1">{t('synth_modal_erp')}</p>
                            <p className="font-medium text-emerald-800 leading-relaxed">{c.ext_truth_value}</p>
                         </div>
                      </div>
                      <div className="mt-3 text-xs bg-white p-3 rounded-lg border border-gray-200 text-gray-600 font-medium shadow-inner">
                         <strong className="text-indigo-600">{t('synth_modal_prop')}</strong> {c.recommended_correction}
                      </div>
                   </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                 <button onClick={() => setIsConflictModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">{t('synth_modal_ignore')}</button>
                 <button onClick={() => handleAutoCorrectionAndResume(conflicts[0])} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-2">
                   <RefreshCw className="w-4 h-4" /> {t('synth_modal_apply')}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}