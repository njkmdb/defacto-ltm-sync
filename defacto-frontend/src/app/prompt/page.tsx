'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Beaker, Save, Plus, Trash2, Search, RefreshCw, ChevronLeft, ChevronRight, XCircle, Code2, Layers, Info, Lock } from 'lucide-react';
import { getPrompts, createPrompt, updatePrompt, deletePrompt, getDefaultPrompts } from '@/lib/api/prompt';
import { PromptItem, SavePromptRequest } from '@/types/api';

const TARGET_TYPES = ["GLOBAL", "ENTITY_TYPE", "ENTITY_ID"];

const STEP_INFO: Record<string, { label: string, title: string, objective: string, input: string, output: string, targetSchema: string, hint: string }> = {
  "A_EXTRACTION": { label: "A단계: 원문 팩트 구조화", title: "[A_EXTRACTION] 비정형 텍스트 구조화 및 핵심 팩트 추출 단계", objective: "수동 적재된 비정형 원문이나 미디어 추출 텍스트에서 오탈자를 교정하고 팩트 원문(fact_content)과 메타데이터(attributes)를 분리합니다.", input: "순수 비정형 텍스트, [참고 마스터 데이터(Entity)]", output: "HierarchicalFactSchema (교정된 팩트, 요약 텍스트, 핵심 키워드 배열)", targetSchema: "HierarchicalFactSchema", hint: "마스터 데이터에 주체가 존재할 경우 'ref_entity_id_1'에 정확히 매핑하도록 지시해야 합니다." },
  "B_PLANNING": { label: "B단계: 일지 에이전트 탐색", title: "[B_PLANNING] 단기 일지 작성을 위한 AI 도구 호출(Planning) 단계", objective: "오늘의 일지 작성을 위해 주어진 요약본을 읽고, 추가적인 '마스터 데이터'나 '상세 팩트 원문'이 더 필요한지 스스로 판단합니다.", input: "오늘 발생한 이벤트 요약본(Index), 연관된 외부 정형 데이터, 과거 이력 요약본", output: "AgentPlanningSchema (추론 과정 및 ToolCall 배열 반환)", targetSchema: "AgentPlanningSchema", hint: "도구 호출이 필요 없다고 판단되면 반드시 'SUFFICIENT_INFO' 도구를 사용하도록 지시하세요." },
  "B_SYNTHESIS": { label: "B단계: 단기 일지 최종 합성", title: "[B_SYNTHESIS] 에이전트 인출 데이터 기반 단기 일지 최종 합성 단계", objective: "검색된 과거 기억, 외부 정형 데이터, 상세 팩트 원문을 모두 교차 검증하여 최종 일지와 후속 업무를 도출합니다.", input: "요약본(Index), [에이전트 인출 데이터(상세 팩트, 마스터)], [외부 정형 데이터]", output: "ContextSynthesisSchema (최종 요약 줄글 및 Action Items 배열)", targetSchema: "ContextSynthesisSchema", hint: "프롬프트 작성 시 '[외부 정형 데이터]', '[에이전트 인출 데이터]' 등의 단어를 명시하여 AI에게 명확히 지시할 수 있습니다." },
  "C_PLANNING": { label: "C단계: 심층 리포트 탐색", title: "[C_PLANNING] 심층 요약 리포트 작성을 위한 AI 도구 호출 단계", objective: "사용자의 질의(목적)와 체리피킹된 핵심 기억을 분석하여, 리포트 작성에 필요한 추가 상세 데이터를 탐색합니다.", input: "사용자 질의(Query Text), 선택된 기억 요약본(Index), 외부 정형 데이터", output: "AgentPlanningSchema (추론 과정 및 ToolCall 배열 반환)", targetSchema: "AgentPlanningSchema", hint: "전문적인 리포트 작성을 위해 필요하다면 지체 없이 'FETCH_FACT_DETAILS' 도구를 호출하게 하세요." },
  "C_BRIEFING": { label: "C단계: 심층 리포트 작성", title: "[C_BRIEFING] 최종 심층 AI 요약 리포트 작성 단계", objective: "사용자의 질의에 완벽히 답하기 위해, 모든 컨텍스트와 인출된 상세 팩트를 종합하여 심층 리포트(Briefing)를 작성합니다.", input: "사용자 질의(Query Text), 요약본(Index), [에이전트 인출 데이터], [외부 정형 데이터]", output: "EventBriefingSchema (총평, 주요 발견 팩트, 위험/경고, 행동 지침)", targetSchema: "EventBriefingSchema", hint: "정보 간의 모순이 있을 경우 절대 지어내지 말고 'risk_and_warnings'에 명시하도록 강력히 통제하세요." },
  "C_CREATIVE": { label: "C단계: 2차 창작 엔진", title: "[C_CREATIVE] 저장된 팩트 기반 톤앤매너 재창조 단계", objective: "원본 데이터를 훼손하지 않으면서도 특정 톤앤매너에 맞게 글을 재구성합니다.", input: "단기 일지, 심층 리포트 등 원본 결과물", output: "CreativeContentSchema", targetSchema: "CreativeContentSchema", hint: "결과물이 지나치게 길어지거나 짧아지지 않도록 max_length를 통제하세요." }
};
const PIPELINE_STEPS = Object.keys(STEP_INFO);

export default function PromptLabPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL');
  const [pipelineStepFilter, setPipelineStepFilter] = useState('ALL');

  const [selectedPrompt, setSelectedPrompt] = useState<PromptItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 💡 max_length 값 추가
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
    onError: (err: any) => alert(err.response?.data?.detail || "저장에 실패했습니다.")
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => deletePrompt(id),
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setIsEditing(false);
      setSelectedPrompt(null);
    },
    onError: (err: any) => alert(err.response?.data?.detail || "삭제에 실패했습니다.")
  });

  const handleSave = () => {
    if (!formData.system_prompt.trim()) return alert("시스템 프롬프트 내용을 입력해야 합니다.");
    if (!formData.target_value.trim() || !formData.schema_name.trim()) return alert("타겟 값과 매핑 스키마명은 필수입니다.");
    saveMut.mutate();
  };

  const handleDelete = () => {
    if (!selectedPrompt) return;
    if (confirm("이 프롬프트를 정말 영구 삭제하시겠습니까?\n삭제 즉시 파이프라인에서 Fallback 프롬프트로 전환됩니다.")) {
      deleteMut.mutate(selectedPrompt.prompt_id);
    }
  };

  const formatDate = (ds: string) => new Date(ds).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' });
  const activeStepInfo = STEP_INFO[formData.pipeline_step as keyof typeof STEP_INFO];

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Beaker className="w-8 h-8 text-purple-600" /> Prompt Lab (프롬프트 랩)
          </h1>
          <p className="text-sm text-gray-500 mt-2">백엔드 재배포 없이 각 파이프라인 단계의 시스템 프롬프트와 Pydantic 스키마를 맵핑하고 동적으로 주입합니다.</p>
        </div>
        <button onClick={handleCreateNew} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition-colors">
          <Plus className="w-5 h-5" /> 새 프롬프트 작성
        </button>
      </header>

      <div className="flex gap-6 h-[calc(100vh-220px)]">
        {/* LEFT PANEL */}
        <div className="w-[450px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden shrink-0">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3 shrink-0">
            <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2"><Search className="w-4 h-4"/> 필터 보드</h2>
            <div className="flex gap-2">
              <select value={targetTypeFilter} onChange={e => setTargetTypeFilter(e.target.value)} className="flex-1 bg-white border border-gray-300 text-xs font-bold text-gray-700 rounded-lg px-2 py-2 outline-none focus:border-purple-500">
                <option value="ALL">All Targets</option>
                {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={pipelineStepFilter} onChange={e => setPipelineStepFilter(e.target.value)} className="flex-1 bg-white border border-gray-300 text-xs font-bold text-gray-700 rounded-lg px-2 py-2 outline-none focus:border-purple-500">
                <option value="ALL">All Steps</option>
                {PIPELINE_STEPS.map(t => <option key={t} value={t}>{STEP_INFO[t].label}</option>)}
              </select>
            </div>
            {(targetTypeFilter !== 'ALL' || pipelineStepFilter !== 'ALL') && (
               <button onClick={resetFilters} className="text-xs font-bold text-red-500 hover:bg-red-50 py-1.5 rounded flex items-center justify-center gap-1 transition-colors"><XCircle className="w-3.5 h-3.5"/> 필터 초기화</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/30 p-3 space-y-2">
            {isLoading || isFetching ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400"><RefreshCw className="w-8 h-8 animate-spin mb-3 text-purple-400" /> 불러오는 중...</div>
            ) : promptData?.data.length === 0 ? (
              <p className="text-center text-sm font-bold text-gray-400 py-10">등록된 프롬프트가 없습니다.</p>
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

        {/* RIGHT PANEL (에디터) */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {!isEditing ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Code2 className="w-16 h-16 mb-4 text-gray-200" />
                <p className="text-lg font-bold">프롬프트를 선택하거나 새로 작성해주세요.</p>
                <p className="text-sm mt-2">LLM 엔진에 주입될 뇌(틀과 페르소나)를 구성합니다.</p>
             </div>
          ) : (
             <>
               <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
                 <h2 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                   {selectedPrompt ? `프롬프트 수정 (ID: ${selectedPrompt.prompt_id})` : '새 시스템 프롬프트 작성'}
                 </h2>
                 {selectedPrompt && (
                   <button onClick={handleDelete} disabled={deleteMut.isPending} className="text-sm font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
                     {deleteMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>} 영구 삭제
                   </button>
                 )}
               </div>

               <div className="flex-1 overflow-y-auto p-6">
                 {/* 미니맵 */}
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

                 {/* 컨텍스트 가이드 */}
                 {activeStepInfo && (
                   <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-6 shadow-inner">
                     <h3 className="text-sm font-extrabold text-indigo-800 mb-2 flex items-center gap-1.5"><Info className="w-4 h-4" /> {activeStepInfo.title}</h3>
                     <ul className="space-y-1.5 text-xs text-indigo-700/80 font-medium ml-1">
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">목적:</strong> {activeStepInfo.objective}</span></li>
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">Input (주입 데이터):</strong> {activeStepInfo.input}</span></li>
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">Output (목표 스키마):</strong> <span className="font-mono bg-white px-1 py-0.5 rounded border border-indigo-200">{activeStepInfo.output}</span></span></li>
                        <li className="flex items-start gap-1.5"><span className="text-indigo-400 font-bold mt-0.5">•</span> <span><strong className="text-indigo-700">Hint:</strong> {activeStepInfo.hint}</span></li>
                     </ul>
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-6 mb-6">
                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Target Type (적용 범위) <span className="text-red-500">*</span></label>
                       <select value={formData.target_type} onChange={e => setFormData({...formData, target_type: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-400">
                         {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Target Value (적용 대상) <span className="text-red-500">*</span></label>
                       <input type="text" value={formData.target_value} onChange={e => setFormData({...formData, target_value: e.target.value})} placeholder="예: ALL, COMPANY, 1024" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-400" />
                       <p className="text-[10px] text-gray-400 mt-1 font-semibold">* GLOBAL일 경우 ALL 입력. ENTITY_ID일 경우 숫자 입력.</p>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Pipeline Step (주입 단계) <span className="text-red-500">*</span></label>
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
                         {PIPELINE_STEPS.map(t => <option key={t} value={t}>{STEP_INFO[t].label}</option>)}
                       </select>
                     </div>
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">AI 응답 포맷 (Output Schema)</label>
                       <div className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2.5 flex items-center justify-between shadow-inner">
                         <span className="text-sm font-mono font-bold text-gray-500">{formData.schema_name}</span>
                         <Lock className="w-4 h-4 text-gray-400" />
                       </div>
                       <p className="text-[10px] text-gray-500 mt-1 font-semibold leading-tight flex items-start gap-1">
                         <Info className="w-3 h-3 shrink-0" />
                         백엔드 코드와 1:1 매핑되어 있어 임의로 변경할 수 없습니다.
                       </p>
                     </div>
                   </div>
                 </div>

                 <div className="flex flex-col min-h-[350px]">
                   <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                     <span>System Prompt (엔진 지시문) <span className="text-red-500">*</span></span>
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                           <span className="text-xs text-gray-500 font-bold">Temp:</span>
                           <input type="number" min="0" max="1" step="0.1" value={formData.temperature} onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value) || 0.7})} className="w-16 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:ring-2 focus:ring-purple-400 font-bold text-purple-700" />
                        </div>
                        {/* 💡 길이 제한 인풋 추가 */}
                        <div className="flex items-center gap-1.5">
                           <span className="text-xs text-gray-500 font-bold">Length:</span>
                           <input type="number" min="100" step="100" value={formData.max_length} onChange={e => setFormData({...formData, max_length: parseInt(e.target.value) || 1000})} className="w-16 px-2 py-1 text-xs border border-gray-300 rounded outline-none focus:ring-2 focus:ring-purple-400 font-bold text-purple-700" />
                        </div>
                       <div className="flex items-center gap-2 border-l pl-3 border-gray-200">
                         <span className="text-xs text-gray-500 font-medium">활성화 스위치</span>
                         <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="w-5 h-5 text-emerald-500 rounded cursor-pointer focus:ring-emerald-500" />
                       </div>
                     </div>
                   </label>
                   <textarea 
                     value={formData.system_prompt} 
                     onChange={e => setFormData({...formData, system_prompt: e.target.value})} 
                     placeholder="당신은 AI 데이터 에이전트입니다..."
                     className="flex-1 w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:outline-none text-sm text-gray-800 bg-gray-50 leading-relaxed resize-none font-medium shadow-inner" 
                   />
                 </div>

                 <div className="mt-4 bg-purple-50/50 border border-purple-100 rounded-xl p-4">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-extrabold text-purple-800 flex items-center gap-1.5">
                       <Beaker className="w-3.5 h-3.5" /> 해당 단계의 시스템 기본 프롬프트 (Fallback Reference)
                     </span>
                     <button
                       onClick={() => setFormData({...formData, system_prompt: defaultPromptsData?.data?.[formData.pipeline_step] || ''})}
                       className="text-xs font-bold text-purple-700 bg-white border border-purple-200 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1"
                     >
                       기본 프롬프트 불러오기
                     </button>
                   </div>
                   <p className="text-xs text-gray-600 font-medium leading-relaxed bg-white/60 p-3 rounded-lg border border-purple-50 whitespace-pre-wrap">
                     {defaultPromptsData?.data?.[formData.pipeline_step] || '기본 프롬프트 정보를 불러오고 있습니다...'}
                   </p>
                 </div>
               </div>

               <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
                 <button onClick={() => setIsEditing(false)} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">취소</button>
                 <button onClick={handleSave} disabled={saveMut.isPending} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-8 py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors disabled:opacity-50">
                   {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} 변경 사항 즉시 저장
                 </button>
               </div>
             </>
          )}
        </div>
      </div>
    </main>
  );
}