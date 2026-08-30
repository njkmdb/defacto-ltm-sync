'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Workflow, Play, Save, FolderOpen, RefreshCw, Trash2, FileJson, Beaker, Plus, Search, ChevronLeft, ChevronRight, XCircle, Code2, Layers, Info, Lock } from 'lucide-react';
import { usePipelineStore } from '@/store/usePipelineStore';
import { executeDynamicPipeline, getPipelinePresets, createPipelinePreset, updatePipelinePreset } from '@/lib/api/pipeline';
import { getPrompts, createPrompt, updatePrompt, deletePrompt, getDefaultPrompts } from '@/lib/api/prompt';
import { PromptItem, SavePromptRequest } from '@/types/api';
import NodePalette from '@/components/builder/NodePalette';
import PipelineCanvas from '@/components/builder/PipelineCanvas';
import PropertyEditor from '@/components/builder/PropertyEditor';

const TARGET_TYPES = ["GLOBAL", "ENTITY_TYPE", "ENTITY_ID"];
const PIPELINE_STEPS = ["A_EXTRACTION", "B_PLANNING", "B_SYNTHESIS", "C_PLANNING", "C_BRIEFING", "C_CREATIVE"];

function PromptLabView() {
  const t = useTranslations('Prompt');
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL');
  const [pipelineStepFilter, setPipelineStepFilter] = useState('ALL');

  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const STEP_INFO: Record<string, { label: string, title: string, objective: string, input: string, output: string, targetSchema: string, hint: string }> = {
    "A_EXTRACTION": { label: t('Steps.A_EXTRACTION.label'), title: t('Steps.A_EXTRACTION.title'), objective: t('Steps.A_EXTRACTION.objective'), input: t('Steps.A_EXTRACTION.input'), output: t('Steps.A_EXTRACTION.output'), targetSchema: "HierarchicalFactSchema", hint: t('Steps.A_EXTRACTION.hint') },
    "B_PLANNING": { label: t('Steps.B_PLANNING.label'), title: t('Steps.B_PLANNING.title'), objective: t('Steps.B_PLANNING.objective'), input: t('Steps.B_PLANNING.input'), output: t('Steps.B_PLANNING.output'), targetSchema: "AgentPlanningSchema", hint: t('Steps.B_PLANNING.hint') },
    "B_SYNTHESIS": { label: t('Steps.B_SYNTHESIS.label'), title: t('Steps.B_SYNTHESIS.title'), objective: t('Steps.B_SYNTHESIS.objective'), input: t('Steps.B_SYNTHESIS.input'), output: t('Steps.B_SYNTHESIS.output'), targetSchema: "ContextSynthesisSchema", hint: t('Steps.B_SYNTHESIS.hint') },
    "C_PLANNING": { label: t('Steps.C_PLANNING.label'), title: t('Steps.C_PLANNING.title'), objective: t('Steps.C_PLANNING.objective'), input: t('Steps.C_PLANNING.input'), output: t('Steps.C_PLANNING.output'), targetSchema: "AgentPlanningSchema", hint: t('Steps.C_PLANNING.hint') },
    "C_BRIEFING": { label: t('Steps.C_BRIEFING.label'), title: t('Steps.C_BRIEFING.title'), objective: t('Steps.C_BRIEFING.objective'), input: t('Steps.C_BRIEFING.input'), output: t('Steps.C_BRIEFING.output'), targetSchema: "EventBriefingSchema", hint: t('Steps.C_BRIEFING.hint') },
    "C_CREATIVE": { label: t('Steps.C_CREATIVE.label'), title: t('Steps.C_CREATIVE.title'), objective: t('Steps.C_CREATIVE.objective'), input: t('Steps.C_CREATIVE.input'), output: t('Steps.C_CREATIVE.output'), targetSchema: "CreativeContentSchema", hint: t('Steps.C_CREATIVE.hint') }
  };

  const [formData, setFormData] = useState<SavePromptRequest>({
    target_type: 'GLOBAL', target_value: 'ALL', pipeline_step: 'A_EXTRACTION',
    schema_name: STEP_INFO['A_EXTRACTION'].targetSchema, system_prompt: '', temperature: 0.7, max_length: 1000, is_active: true
  });

  const { data: defaultPromptsData } = useQuery({ queryKey: ['defaultPrompts'], queryFn: getDefaultPrompts });

  const { data: promptData, isLoading, isFetching } = useQuery({
    queryKey: ['prompts', page, limit, targetTypeFilter, pipelineStepFilter],
    queryFn: () => getPrompts(page, limit, targetTypeFilter, pipelineStepFilter)
  });

  const resetFilters = () => { setTargetTypeFilter('ALL'); setPipelineStepFilter('ALL'); setPage(1); };

  const handleCreateNew = () => {
    setSelectedPrompt(null);
    setFormData({ target_type: 'GLOBAL', target_value: 'ALL', pipeline_step: 'A_EXTRACTION', schema_name: STEP_INFO['A_EXTRACTION'].targetSchema, system_prompt: '', temperature: 0.7, max_length: 1000, is_active: true });
    setIsEditing(true);
  };

  const handleSelectPrompt = (prompt: PromptItem) => {
    setSelectedPrompt(prompt);
    setFormData({ target_type: prompt.target_type, target_value: prompt.target_value, pipeline_step: prompt.pipeline_step, schema_name: prompt.schema_name, system_prompt: prompt.system_prompt, temperature: prompt.temperature ?? 0.7, max_length: prompt.max_length ?? 1000, is_active: prompt.is_active });
    setIsEditing(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (selectedPrompt) return updatePrompt(selectedPrompt.prompt_id, formData);
      return createPrompt(formData);
    },
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setIsEditing(false);
      setSelectedPrompt(null);
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_save_fail'))
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => deletePrompt(id),
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setIsEditing(false);
      setSelectedPrompt(null);
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_del_fail'))
  });

  const handleSave = () => {
    if (!formData.system_prompt.trim()) return alert(t('alert_req_prompt'));
    if (!formData.target_value.trim() || !formData.schema_name.trim()) return alert(t('alert_req_target'));
    saveMut.mutate();
  };

  const handleDelete = () => {
    if (!selectedPrompt) return;
    if (confirm(t('alert_confirm_del').replace(/\\n/g, '\n'))) {
      deleteMut.mutate(selectedPrompt.prompt_id);
    }
  };

  const formatDate = (ds: string) => new Date(ds).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  const activeStepInfo = STEP_INFO[formData.pipeline_step as keyof typeof STEP_INFO];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex justify-end mb-4 shrink-0">
        <button onClick={handleCreateNew} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md transition-colors">
          <Plus className="w-4 h-4" /> {t('btn_create')}
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-[450px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3 shrink-0">
            <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2"><Search className="w-4 h-4"/> {t('filter_board')}</h2>
            <div className="flex gap-2">
              <select value={targetTypeFilter} onChange={e => setTargetTypeFilter(e.target.value)} className="flex-1 bg-white border border-gray-300 text-xs font-bold text-gray-700 rounded-lg px-2 py-2 outline-none focus:border-purple-500">
                <option value="ALL">{t('all_targets')}</option>
                {TARGET_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={pipelineStepFilter} onChange={e => setPipelineStepFilter(e.target.value)} className="flex-1 bg-white border border-gray-300 text-xs font-bold text-gray-700 rounded-lg px-2 py-2 outline-none focus:border-purple-500">
                <option value="ALL">{t('all_steps')}</option>
                {PIPELINE_STEPS.map(step => <option key={step} value={step}>{STEP_INFO[step].label}</option>)}
              </select>
            </div>
            {(targetTypeFilter !== 'ALL' || pipelineStepFilter !== 'ALL') && (
               <button onClick={resetFilters} className="text-xs font-bold text-red-500 hover:bg-red-50 py-1.5 rounded flex items-center justify-center gap-1 transition-colors"><XCircle className="w-3.5 h-3.5"/> {t('btn_reset')}</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/30 p-3 space-y-2">
            {isLoading || isFetching ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400"><RefreshCw className="w-8 h-8 animate-spin mb-3 text-purple-400" /> {t('state_loading')}</div>
            ) : promptData?.data.length === 0 ? (
              <p className="text-center text-sm font-bold text-gray-400 py-10">{t('state_empty')}</p>
            ) : (
              promptData?.data.map((item: PromptItem) => (
                <div 
                  key={item.prompt_id} onClick={() => handleSelectPrompt(item)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedPrompt?.prompt_id === item.prompt_id ? 'bg-purple-50 border-purple-400 shadow-sm ring-1 ring-purple-400' : 'bg-white border-gray-200 hover:border-purple-300 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold text-white bg-gray-800 px-2 py-0.5 rounded">{STEP_INFO[item.pipeline_step]?.label || item.pipeline_step}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${item.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                      <span className="text-[10px] font-bold text-gray-500">{item.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-blue-500"/> {item.target_type}: {item.target_value}</h3>
                  <p className="text-xs text-gray-500 truncate mb-2">{item.system_prompt}</p>
                  <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                     <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{item.schema_name}</span>
                     <span className="text-[9px] text-gray-400 font-medium">{formatDate(item.up_ts)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {promptData?.meta && promptData.meta.total_pages > 1 && (
            <div className="p-3 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
               <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4"/></button>
               <span className="text-xs font-bold text-gray-500">{page} / {promptData.meta.total_pages}</span>
               <button disabled={page >= promptData.meta.total_pages} onClick={() => setPage(p => p + 1)} className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-4 h-4"/></button>
            </div>
          )}
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {!isEditing ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Code2 className="w-16 h-16 mb-4 text-gray-200" />
                <p className="text-lg font-bold">{t('editor_empty_title')}</p>
                <p className="text-sm mt-2">{t('editor_empty_desc')}</p>
             </div>
          ) : (
             <>
               <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
                 <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                   {selectedPrompt ? t('editor_title_edit', { id: selectedPrompt.prompt_id }) : t('editor_title_new')}
                 </h2>
                 {selectedPrompt && (
                   <button onClick={handleDelete} disabled={deleteMut.isPending} className="text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
                     {deleteMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>} {t('btn_delete')}
                   </button>
                 )}
               </div>

               <div className="flex-1 overflow-y-auto p-6">
                 <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 shadow-sm mb-4">
                    {PIPELINE_STEPS.map((step, idx) => {
                       const isActive = formData.pipeline_step === step;
                       return (
                          <React.Fragment key={step}>
                             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${isActive ? 'bg-purple-100 border border-purple-200 shadow-sm' : 'opacity-60'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${isActive ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{idx + 1}</span>
                                <span className={`text-xs font-bold ${isActive ? 'text-purple-800' : 'text-gray-500'}`}>{STEP_INFO[step].label.split(':')[0]}</span>
                             </div>
                             {idx < PIPELINE_STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
                          </React.Fragment>
                       )
                    })}
                 </div>

                 {activeStepInfo && (
                   <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-6 shadow-inner">
                     <h3 className="text-sm font-extrabold text-indigo-800 mb-2 flex items-center gap-1.5"><Info className="w-4 h-4" /> {activeStepInfo.title}</h3>
                     <ul className="space-y-1.5 text-xs text-indigo-700/80 font-medium ml-1">
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">{t('step_info_title')}:</strong> {activeStepInfo.objective}</span></li>
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">{t('step_info_in')}:</strong> {activeStepInfo.input}</span></li>
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">{t('step_info_out')}:</strong> <span className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">{activeStepInfo.output}</span></span></li>
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">{t('step_info_hint')}:</strong> {activeStepInfo.hint}</span></li>
                     </ul>
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-6 mb-6">
                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">{t('label_target_type')} <span className="text-red-500">*</span></label>
                       <select value={formData.target_type} onChange={e => setFormData({...formData, target_type: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-400">
                         {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">{t('label_target_value')} <span className="text-red-500">*</span></label>
                       <input type="text" value={formData.target_value} onChange={e => setFormData({...formData, target_value: e.target.value})} placeholder={t('placeholder_target_value')} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-400" />
                       <p className="text-[10px] text-gray-400 mt-1 font-semibold">{t('hint_target_value')}</p>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">{t('label_step')} <span className="text-red-500">*</span></label>
                       <select 
                         value={formData.pipeline_step} 
                         onChange={e => {
                           const newStep = e.target.value;
                           setFormData({
                             ...formData, 
                             pipeline_step: newStep, 
                             schema_name: STEP_INFO[newStep].targetSchema
                           });
                         }} 
                         className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-400"
                       >
                         {PIPELINE_STEPS.map(step => <option key={step} value={step}>{STEP_INFO[step].label}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">{t('label_schema')}</label>
                       <div className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2.5 flex items-center justify-between shadow-inner">
                         <span className="text-sm font-mono font-bold text-gray-500">{formData.schema_name}</span>
                         <Lock className="w-4 h-4 text-gray-400" />
                       </div>
                       <p className="text-[10px] text-gray-500 mt-1 font-semibold leading-tight flex items-start gap-1">
                         <Info className="w-3 h-3 shrink-0" />
                         {t('hint_schema')}
                       </p>
                     </div>
                   </div>
                 </div>

                 <div className="flex flex-col min-h-[350px]">
                   <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                     <span>{t('label_prompt')} <span className="text-red-500">*</span></span>
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                           <span className="text-xs text-gray-500 font-bold">Temp:</span>
                           <input type="number" min="0" max="1" step="0.1" value={formData.temperature} onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value) || 0.7})} className="w-16 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:ring-2 focus:ring-purple-400 font-bold text-purple-700" />
                        </div>
                        <div className="flex items-center gap-1.5">
                           <span className="text-xs text-gray-500 font-bold">Length:</span>
                           <input type="number" min="100" step="100" value={formData.max_length} onChange={e => setFormData({...formData, max_length: parseInt(e.target.value) || 1000})} className="w-16 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:ring-2 focus:ring-purple-400 font-bold text-purple-700" />
                        </div>
                       <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
                         <span className="text-xs text-gray-500 font-medium">{t('label_active')}</span>
                         <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-emerald-500 rounded cursor-pointer focus:ring-emerald-500" />
                       </div>
                     </div>
                   </label>
                   <textarea 
                     value={formData.system_prompt} 
                     onChange={e => setFormData({...formData, system_prompt: e.target.value})} 
                     placeholder={t('placeholder_prompt')}
                     className="flex-1 w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:outline-none text-sm text-gray-800 bg-gray-50 leading-relaxed resize-none font-medium shadow-inner" 
                   />
                 </div>

                 <div className="mt-4 bg-purple-50/50 border border-purple-100 rounded-xl p-4">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-extrabold text-purple-800 flex items-center gap-1.5">
                       <Beaker className="w-3.5 h-3.5" /> {t('fallback_title')}
                     </span>
                     <button
                       onClick={() => setFormData({...formData, system_prompt: defaultPromptsData?.data?.[formData.pipeline_step] || ''})}
                       className="text-xs font-bold text-purple-700 bg-white border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1"
                     >
                       {t('btn_load_default')}
                     </button>
                   </div>
                   <p className="text-xs text-gray-600 font-medium leading-relaxed bg-white/60 p-3 rounded-lg border border-purple-50 whitespace-pre-wrap">
                     {defaultPromptsData?.data?.[formData.pipeline_step] || t('fallback_loading')}
                   </p>
                 </div>
               </div>

               <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">{t('btn_cancel')}</button>
                 <button onClick={handleSave} disabled={saveMut.isPending} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors disabled:opacity-50">
                   {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t('btn_save_changes')}
                 </button>
               </div>
             </>
          )}
        </div>
      </div>
    </div>
  );
}

function BuilderView() {
  const t = useTranslations('Builder');
  const queryClient = useQueryClient();
  const { nodes, setNodes, clearNodes } = usePipelineStore();
  
  const [pipelineId, setPipelineId] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [description, setDescription] = useState('');

  const [testEntityId, setTestEntityId] = useState<number>(1024);
  const [initialContext, setInitialContext] = useState<string>('{\n  "query_text": "최근 협상 이력을 찾아줘",\n  "reference_date": "2026-08-28"\n}');
  
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const { data: presets } = useQuery({
    queryKey: ['pipelinePresets'],
    queryFn: () => getPipelinePresets(1, 50)
  });

  const savePresetMut = useMutation({
    mutationFn: async () => {
      const payload = {
        pipeline_name: pipelineName || 'Untitled Pipeline',
        description: description,
        config_json: nodes,
        is_active: true
      };
      if (pipelineId) {
        return await updatePipelinePreset(pipelineId, payload);
      } else {
        const newId = `pipe_${Date.now()}`;
        return await createPipelinePreset({ pipeline_id: newId, ...payload });
      }
    },
    onSuccess: () => {
      alert(t('alert_save_success'));
      queryClient.invalidateQueries({ queryKey: ['pipelinePresets'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "Error")
  });

  const executeMut = useMutation({
    mutationFn: async () => {
      let parsedContext = {};
      try { parsedContext = JSON.parse(initialContext); } catch (e) { throw new Error(t('alert_invalid_json')); }

      return await executeDynamicPipeline({
        base_entity_id: testEntityId,
        initial_context: parsedContext,
        steps: nodes
      });
    },
    onSuccess: (data) => {
      setExecutionResult(data.final_state);
      setIsTestModalOpen(true);
    },
    onError: (err: any) => alert(err.response?.data?.detail || err.message || "Error")
  });

  const handleSave = () => {
    if (nodes.length === 0) return alert(t('alert_save_empty'));
    savePresetMut.mutate();
  };

  const handleExecute = () => {
    if (nodes.length === 0) return alert(t('alert_execute_empty'));
    executeMut.mutate();
  };

  const handleLoadPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    if (!pid) {
      clearNodes();
      setPipelineId('');
      setPipelineName('');
      setDescription('');
      return;
    }
    const preset = presets?.data?.find((p: any) => p.pipeline_id === pid);
    if (preset) {
      setPipelineId(preset.pipeline_id);
      setPipelineName(preset.pipeline_name);
      setDescription(preset.description || '');
      setNodes(preset.config_json);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex justify-end gap-3 mb-4 shrink-0">
        <button onClick={() => { clearNodes(); setPipelineId(''); setPipelineName(''); setDescription(''); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm">
          <Trash2 className="w-4 h-4" /> {t('btn_clear')}
        </button>
        
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm">
          <FolderOpen className="w-4 h-4 text-gray-400 ml-1" />
          <select onChange={handleLoadPreset} className="text-sm font-bold text-gray-700 outline-none cursor-pointer bg-transparent">
            <option value="">{t('preset_load')}</option>
            {presets?.data?.map((p: any) => (
              <option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}</option>
            ))}
          </select>
        </div>

        <button onClick={handleSave} disabled={savePresetMut.isPending} className="px-5 py-2 bg-gray-900 text-white hover:bg-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md">
          {savePresetMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} {t('btn_save')}
        </button>
      </div>

      <div className="flex gap-4 mb-4 shrink-0 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1 border-r border-gray-200 pr-4">
          <label className="text-xs font-bold text-gray-500">{t('input_name_desc')}</label>
          <div className="flex gap-2">
            <input type="text" placeholder={t('placeholder_name')} value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 outline-none focus:border-blue-400" />
            <input type="text" placeholder={t('placeholder_desc')} value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-bold text-gray-500">{t('test_title')}</label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{t('target_entity')}</span>
            <input type="number" value={testEntityId} onChange={e => setTestEntityId(Number(e.target.value))} className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 outline-none focus:border-blue-400"/>
            <input type="text" value={initialContext} onChange={e => setInitialContext(e.target.value)} placeholder={t('placeholder_context')} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-blue-400" />
            
            <button onClick={handleExecute} disabled={executeMut.isPending} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md">
              {executeMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current" />} {t('btn_execute')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        <NodePalette />
        <PipelineCanvas />
        <PropertyEditor />
      </div>

      {isTestModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-[800px] max-w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-200 bg-gray-900 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2"><FileJson className="w-5 h-5 text-blue-400"/> {t('result_title')}</h2>
              <button onClick={() => setIsTestModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">{t('btn_close')}</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
              <pre className="text-xs text-gray-800 bg-white p-4 rounded-xl border border-gray-200 shadow-inner whitespace-pre-wrap font-mono">
                {JSON.stringify(executionResult, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PipelineStudioPage() {
  const tBuilder = useTranslations('Builder');
  const [mode, setMode] = useState<'BUILDER' | 'PROMPT'>('BUILDER');

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20 flex flex-col h-screen overflow-hidden">
      <header className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Workflow className="w-8 h-8 text-blue-600" /> {tBuilder('studio_title')}
          </h1>
          <p className="text-sm text-gray-500 mt-2">{tBuilder('studio_subtitle')}</p>
        </div>
        
        {/* 모드 전환 스위치 */}
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setMode('BUILDER')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${mode === 'BUILDER' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {tBuilder('mode_builder')}
          </button>
          <button onClick={() => setMode('PROMPT')} className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${mode === 'PROMPT' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {tBuilder('mode_prompt')}
          </button>
        </div>
      </header>

      {mode === 'BUILDER' ? <BuilderView /> : <PromptLabView />}
    </main>
  );
}