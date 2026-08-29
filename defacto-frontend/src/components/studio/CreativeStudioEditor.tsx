'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, RefreshCw, Save, Download, FileText, Wand2, Type, Database, ArrowLeft, Search, X, Trash2, Copy } from 'lucide-react';
import { generateCreativeContent, generateMetaPrompt, saveCreativeContent } from '@/lib/api/pipeline';
import { getPrompts, createPrompt, deletePrompt } from '@/lib/api/prompt';
import { getEventLog, getEventLogs } from '@/lib/api/archive';
import { getEventBriefing, getEventBriefings } from '@/lib/api/memoryApi';
import { getEventCreation, getEventCreations } from '@/lib/api/creative';
import { PromptItem } from '@/types/api';

interface CreativeStudioEditorProps {
  initialSources?: { type: 'LOG' | 'BRIEFING' | 'CREATION'; id: number; baseEntityId: number }[];
  onNavigateArchive: () => void;
}

type SelectedSource = {
  type: 'LOG' | 'BRIEFING' | 'CREATION';
  id: number;
  baseEntityId: number;
  isChecked: boolean;
};

export default function CreativeStudioEditor({ initialSources, onNavigateArchive }: CreativeStudioEditorProps) {
  const queryClient = useQueryClient();
  
  const [selectedSources, setSelectedSources] = useState<SelectedSource[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState<number>(0);
  const [tempSelectedSources, setTempSelectedSources] = useState<SelectedSource[]>([]);

  const activeSource = selectedSources[activeSourceIndex] || null;
  const sourceType = activeSource?.type || null;
  const sourceId = activeSource?.id || null;
  const baseEntityId = activeSource?.baseEntityId || null;
  
  const [activeTone, setActiveTone] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [userIntent, setUserIntent] = useState<string>('');
  const [creativeTitle, setCreativeTitle] = useState<string>('');
  const [creativeContent, setCreativeContent] = useState<string>('');
  
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxLength, setMaxLength] = useState<number>(1000);

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [sourceSearchTab, setSourceSearchTab] = useState<'LOG' | 'BRIEFING' | 'CREATION'>('LOG');

  const initialSourcesStr = JSON.stringify(initialSources);

  useEffect(() => {
    if (initialSources && initialSources.length > 0) {
      setSelectedSources(initialSources.map(s => ({ ...s, isChecked: true })));
      setActiveSourceIndex(0);
    }
  }, [initialSourcesStr]);

  useEffect(() => {
    if (isSourceModalOpen) {
      setTempSelectedSources([...selectedSources]);
    }
  }, [isSourceModalOpen, selectedSources]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '200px'; 
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(200, scrollHeight) + 'px';
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [creativeContent]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCreativeContent(e.target.value);
  };

  const handleCopy = (text: string, label: string) => {
    if (!text.trim()) {
      return alert("복사할 내용이 없습니다.");
    }
    navigator.clipboard.writeText(text)
      .then(() => alert(`${label} 클립보드에 복사되었습니다.`))
      .catch(err => alert("복사 실패: " + err));
  };

  const toggleTempSelect = (type: 'LOG' | 'BRIEFING' | 'CREATION', id: number, entityId: number) => {
    setTempSelectedSources(prev => {
      const exists = prev.find(p => p.type === type && p.id === id);
      if (exists) return prev.filter(p => !(p.type === type && p.id === id));
      return [...prev, { type, id, baseEntityId: entityId, isChecked: true }];
    });
  };

  const confirmSelection = () => {
    setSelectedSources(tempSelectedSources);
    if (tempSelectedSources.length > 0) setActiveSourceIndex(0);
    setIsSourceModalOpen(false);
  };

  const handleRemoveSource = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const newSources = selectedSources.filter((_, i) => i !== idx);
    setSelectedSources(newSources);
    if (activeSourceIndex === idx) setActiveSourceIndex(0);
    else if (activeSourceIndex > idx) setActiveSourceIndex(activeSourceIndex - 1);
  };

  const toggleCheckSource = (idx: number) => {
    setSelectedSources(prev => prev.map((s, i) => i === idx ? { ...s, isChecked: !s.isChecked } : s));
  };

  const { data: sourceContent = '', isLoading: isSourceLoading } = useQuery({
    queryKey: ['sourceContent', sourceType, sourceId, baseEntityId],
    queryFn: async () => {
      if (!sourceId || !sourceType || !baseEntityId) return '';
      if (sourceType === 'LOG') {
        const res = await getEventLog(sourceId, baseEntityId);
        return res.data.llm_summary;
      } else if (sourceType === 'BRIEFING') {
        const res = await getEventBriefing(sourceId, baseEntityId);
        const b = res.data;
        const findingsStr = b.key_findings?.length ? b.key_findings.join('\n- ') : '없음';
        const risksStr = b.risk_and_warnings?.length ? b.risk_and_warnings.join('\n- ') : '없음';
        const actionsStr = b.recommended_actions?.length ? b.recommended_actions.join('\n- ') : '없음';
        return `■ 총평\n${b.executive_summary}\n\n■ 주요 발견\n- ${findingsStr}\n\n■ 위험/경고\n- ${risksStr}\n\n■ 행동 지침\n- ${actionsStr}`;
      } else if (sourceType === 'CREATION') {
        const res = await getEventCreation(sourceId, baseEntityId);
        const c = res.data;
        return `■ 원본 창작물 제목: ${c.creative_title}\n\n■ 창작물 내용:\n${c.creative_content}`;
      }
      return '';
    },
    enabled: !!sourceId && !!sourceType && !!baseEntityId
  });

  const { data: recentLogs, isLoading: isLogsLoading } = useQuery({ 
    queryKey: ['recentLogsStudio'], 
    queryFn: () => getEventLogs(1, 10), 
    enabled: isSourceModalOpen && sourceSearchTab === 'LOG' 
  });
  
  const { data: recentBriefings, isLoading: isBriefingsLoading } = useQuery({ 
    queryKey: ['recentBriefingsStudio'], 
    queryFn: () => getEventBriefings(1, 10), 
    enabled: isSourceModalOpen && sourceSearchTab === 'BRIEFING' 
  });

  const { data: recentCreations, isLoading: isCreationsLoading } = useQuery({ 
    queryKey: ['recentCreationsStudio'], 
    queryFn: () => getEventCreations(1, 10), 
    enabled: isSourceModalOpen && sourceSearchTab === 'CREATION' 
  });

  const { data: presets } = useQuery({
    queryKey: ['prompts', 1, 100, 'TONE_PRESET', 'C_CREATIVE'],
    queryFn: () => getPrompts(1, 100, 'TONE_PRESET', 'C_CREATIVE'),
  });

  const activePreset = presets?.data?.find((p: PromptItem) => p.target_value === activeTone);

  const metaPromptMut = useMutation({
    mutationFn: async () => await generateMetaPrompt({ user_intent: userIntent }),
    onSuccess: (data) => {
      setActiveTone('CUSTOM');
      setSystemPrompt(data.data.suggested_prompt);
    },
    onError: (err: any) => alert(err.response?.data?.detail || "메타 프롬프트 생성 실패")
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const checkedSources = selectedSources.filter(s => s.isChecked).map(s => ({
        source_type: s.type,
        source_id: s.id
      }));
      
      if (checkedSources.length === 0) {
          throw new Error("저장할 소스가 최소 1개 이상 선택되어야 합니다.");
      }
      
      const rep = selectedSources.find(s => s.isChecked) || selectedSources[0]; 

      return await generateCreativeContent({ 
        sources: checkedSources, 
        base_entity_id: rep.baseEntityId, 
        system_instruction: systemPrompt, 
        temperature, 
        max_length: maxLength 
      });
    },
    onSuccess: (data) => {
      setCreativeContent(data.data.creative_content);
      setCreativeTitle(data.data.creative_title);
    },
    onError: (err: any) => alert(err.response?.data?.detail || err.message || "AI 팩트 훼손 감지(Hallucination Block) 또는 오류가 발생했습니다.")
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const checkedSources = selectedSources.filter(s => s.isChecked).map(s => ({
        source_type: s.type,
        source_id: s.id
      }));
      
      if (checkedSources.length === 0) {
          throw new Error("저장할 소스가 최소 1개 이상 선택되어야 합니다.");
      }
      
      const rep = selectedSources.find(s => s.isChecked) || selectedSources[0]; 
      return await saveCreativeContent({
        sources: checkedSources,
        base_entity_id: rep.baseEntityId,
        tone_name: activeTone || 'CUSTOM', 
        creative_title: creativeTitle, 
        creative_content: creativeContent
      });
    },
    onSuccess: (data) => {
      alert(data.message);
      queryClient.invalidateQueries({ queryKey: ['eventCreations'] });
      onNavigateArchive(); 
    },
    onError: (err: any) => alert(err.response?.data?.detail || err.message || "저장에 실패했습니다.")
  });

  const savePresetMut = useMutation({
    mutationFn: async (presetName: string) => await createPrompt({
      target_type: 'TONE_PRESET', target_value: presetName, pipeline_step: 'C_CREATIVE', schema_name: 'CreativeContentSchema', system_prompt: systemPrompt, temperature, max_length: maxLength, is_active: true
    }),
    onSuccess: () => {
      alert("새로운 톤앤매너 프리셋이 성공적으로 저장되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "프리셋 저장 실패")
  });

  const deletePresetMut = useMutation({
    mutationFn: async (id: number) => await deletePrompt(id),
    onSuccess: () => {
      alert("프리셋이 성공적으로 삭제되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      setActiveTone('');
      setSystemPrompt('');
    },
    onError: (err: any) => alert(err.response?.data?.detail || "프리셋 삭제 실패")
  });

  const handleSavePreset = () => {
    const name = prompt("새로운 프리셋의 이름을 입력하세요 (예: 코믹 오피스물)");
    if (name && name.trim()) savePresetMut.mutate(name.trim());
  };

  const handleDeletePreset = (id: number) => {
    if (confirm("현재 선택된 톤앤매너 프리셋을 영구 삭제하시겠습니까?")) {
      deletePresetMut.mutate(id);
    }
  };

  const handleDownloadTxt = () => {
    const textData = `[${creativeTitle}]\n\n${creativeContent}`;
    const blob = new Blob(["\uFEFF" + textData], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Defacto_Creation_${Date.now()}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const checkedCount = selectedSources.filter(s => s.isChecked).length;

  return (
    <div className="w-full h-auto flex flex-col bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
      <div className="flex flex-row h-[850px] border-b border-gray-200 shrink-0">
        <div className="w-[50%] bg-gray-50 flex flex-col border-r border-gray-200 shrink-0 overflow-hidden">
          <div className="p-4 bg-gray-100 border-b border-gray-200 flex justify-between items-center shrink-0">
            <h3 className="font-bold flex items-center gap-2 text-gray-700">
              <Database className="w-4 h-4"/> 1. 원본 팩트
            </h3>
            <button onClick={() => setIsSourceModalOpen(true)} className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 font-bold shadow-sm transition-colors">
              <Search className="w-3.5 h-3.5" /> 찾아보기
            </button>
          </div>

          <div className="flex overflow-x-auto bg-gray-100 border-b border-gray-200 pt-2 px-2 gap-1 scrollbar-hide shrink-0 min-h-[42px]">
            {selectedSources.map((src, idx) => (
              <div 
                key={`${src.type}-${src.id}`} 
                onClick={() => setActiveSourceIndex(idx)} 
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl cursor-pointer border border-b-0 transition-colors whitespace-nowrap ${activeSourceIndex === idx ? 'bg-white border-gray-200 text-indigo-700 shadow-[0_-2px_4px_rgba(0,0,0,0.02)] z-10' : 'bg-gray-200/60 border-transparent text-gray-500 hover:bg-gray-200'}`}
              >
                <input 
                  type="checkbox" 
                  checked={src.isChecked} 
                  onChange={(e) => { e.stopPropagation(); toggleCheckSource(idx); }}
                  className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer mr-0.5"
                />
                <FileText className={`w-3.5 h-3.5 ${activeSourceIndex === idx ? 'text-indigo-500' : 'text-gray-400'}`} /> 
                {src.type === 'LOG' ? '일지' : src.type === 'BRIEFING' ? '리포트' : '창작물'} #{src.id}
                <button 
                  onClick={(e) => handleRemoveSource(e, idx)} 
                  className={`ml-1 rounded transition-colors ${activeSourceIndex === idx ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-gray-400 hover:text-red-500'}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3 relative min-h-0">
            {selectedSources.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-center">
                 <Database className="w-10 h-10 mb-3 opacity-20" />
                 <p className="text-sm font-bold">불러온 원본 데이터가 없습니다.</p>
                 <p className="text-xs mt-1 text-gray-500 leading-relaxed">상단의 '찾아보기' 버튼을 클릭하여<br/>원하는 데이터를 다중 선택해 불러오세요.</p>
              </div>
            ) : isSourceLoading ? (
               <div className="flex-1 flex flex-col items-center justify-center text-purple-500"><RefreshCw className="w-8 h-8 animate-spin mb-4"/></div>
            ) : (
              <>
                <div className="flex items-center gap-2 shrink-0">
                   <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border inline-flex items-center shadow-sm">
                     <FileText className="w-3 h-3 mr-1"/> {sourceType} #{sourceId}
                   </span>
                   <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded">Entity ID: {baseEntityId}</span>
                </div>
                <div className="relative flex-1 flex flex-col min-h-0">
                  {sourceContent && (
                    <button onClick={() => handleCopy(sourceContent, '원본 팩트가')} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shadow-sm bg-white/90 backdrop-blur-sm border border-gray-200 z-10" title="클립보드 복사">
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white p-4 pr-12 rounded-xl border border-gray-200 shadow-sm flex-1 overflow-y-auto">
                    {sourceContent}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="w-[50%] bg-white flex flex-col shrink-0">
          <div className="p-4 bg-purple-50/50 border-b border-gray-200 shrink-0">
            <h3 className="font-bold flex items-center gap-2 text-purple-800"><Wand2 className="w-4 h-4"/> 2. 톤앤매너 제어 (Meta-Prompt)</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-5">
            <div className="flex flex-col gap-4 shrink-0">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500">사전 정의 프리셋 칩</label>
                  {activePreset && (
                    <button 
                      onClick={() => handleDeletePreset(activePreset.prompt_id)}
                      disabled={deletePresetMut.isPending}
                      className="text-[10px] bg-red-50 text-red-500 hover:text-red-600 border border-red-100 hover:bg-red-100 px-2 py-0.5 rounded shadow-sm transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {deletePresetMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Trash2 className="w-3 h-3"/>}
                      선택 프리셋 삭제
                    </button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {presets?.data?.length === 0 && <span className="text-xs text-gray-400">등록된 프리셋이 없습니다.</span>}
                  {presets?.data?.map((p: PromptItem) => (
                    <button 
                      key={p.prompt_id} 
                      onClick={() => { 
                        setActiveTone(p.target_value); 
                        setSystemPrompt(p.system_prompt); 
                        setTemperature(p.temperature ?? 0.7); 
                        setMaxLength(p.max_length ?? 1000); 
                      }} 
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors border ${activeTone === p.target_value ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'}`}
                    >
                      {p.target_value}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-bold text-gray-500 mb-2 block">마법사 모드 (프롬프트 자동 제안)</label>
                <div className="flex gap-2">
                  <input type="text" value={userIntent} onChange={e => setUserIntent(e.target.value)} onKeyDown={e => e.key === 'Enter' && metaPromptMut.mutate()} placeholder="예: 무협지 스타일로 비장하게" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400 font-medium text-gray-700" />
                  <button onClick={() => metaPromptMut.mutate()} disabled={metaPromptMut.isPending || !userIntent.trim()} className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-bold text-xs hover:bg-purple-200 transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1">
                    {metaPromptMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5"/>} 작성
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col border-t border-gray-100 pt-4 min-h-0">
              <div className="mb-2 flex items-center justify-between">
                 <label className="text-xs font-bold text-gray-500">
                   시스템 프롬프트 (수동 편집)
                 </label>
                 <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                   <button onClick={handleSavePreset} disabled={!systemPrompt.trim() || savePresetMut.isPending} className="text-[10px] bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1">
                     <Save className="w-3 h-3" /> 내 프리셋으로 저장
                   </button>
                   
                   <div className="flex items-center gap-1 relative group">
                     <span className="text-[10px] text-gray-500 font-bold cursor-help">Length:</span>
                     <input 
                       type="number" 
                       min="100" step="100" 
                       value={maxLength} 
                       onChange={e => setMaxLength(parseInt(e.target.value) || 1000)} 
                       className="w-16 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded outline-none focus:ring-1 focus:ring-blue-400 shadow-inner"
                     />
                   </div>

                   <div className="flex items-center gap-1 relative group border-l pl-2 border-gray-200">
                     <span className="text-[10px] text-gray-500 font-bold cursor-help">Temp:</span>
                     <input 
                       type="number" 
                       min="0" max="1" step="0.1" 
                       value={temperature} 
                       onChange={e => setTemperature(parseFloat(e.target.value))} 
                       className="w-14 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded outline-none focus:ring-1 focus:ring-purple-400 shadow-inner"
                     />
                   </div>
                 </div>
              </div>

              <div className="relative flex-1 flex flex-col mb-4 min-h-[120px]">
                {systemPrompt && (
                  <button onClick={() => handleCopy(systemPrompt, '시스템 프롬프트가')} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors shadow-sm bg-white/90 backdrop-blur-sm border border-gray-200 z-10" title="클립보드 복사">
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="flex-1 w-full p-4 pr-12 border border-gray-300 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50 shadow-inner resize-none text-gray-800 font-medium"/>
              </div>
              
              <button 
                onClick={() => generateMut.mutate()} 
                disabled={generateMut.isPending || !systemPrompt.trim() || checkedCount === 0} 
                className={`w-full py-3.5 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 shadow-md shrink-0 ${checkedCount > 0 ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-400'}`}
              >
                {generateMut.isPending ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5"/>} 
                {checkedCount > 0 ? `🚀 체크된 ${checkedCount}개의 팩트로 창작 시작` : '팩트를 체크해주세요'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-white flex flex-col">
        <div className="p-4 bg-emerald-50/50 border-b border-gray-200 flex justify-between items-center shrink-0">
          <h3 className="font-bold flex items-center gap-2 text-emerald-800"><FileText className="w-4 h-4"/> 3. 최종 결과물 에디터</h3>
          <button onClick={onNavigateArchive} className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-gray-800 bg-white border border-gray-300 px-3 py-1.5 rounded-lg shadow-sm transition-colors"><ArrowLeft className="w-4 h-4"/> 아카이브 목록으로 이동</button>
        </div>
        
        <div className="p-6 flex flex-col gap-4 bg-gray-50/30">
          {generateMut.isPending ? (
            <div className="flex flex-col items-center justify-center text-purple-600 py-16 min-h-[200px]">
              <RefreshCw className="w-12 h-12 animate-spin mb-4 text-purple-400"/>
              <p className="font-bold text-lg text-purple-800">창의적인 문장으로 다중 팩트를 재구성하고 있습니다...</p>
            </div>
          ) : !creativeContent ? (
            <div className="flex flex-col items-center justify-center text-gray-300 py-16 min-h-[200px]">
              <Type className="w-16 h-16 mb-4 text-gray-200"/>
              <p className="font-bold text-gray-400">생성된 2차 창작물이 여기에 표시됩니다.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Creative Title</label>
                <input type="text" value={creativeTitle} onChange={e => setCreativeTitle(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-extrabold text-xl text-gray-800 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm"/>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  Creative Content
                </label>
                <div className="relative w-full">
                  {creativeContent && (
                    <button onClick={() => handleCopy(creativeContent, '최종 결과물이')} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shadow-sm bg-white/90 backdrop-blur-sm border border-gray-200 z-10" title="클립보드 복사">
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  <textarea 
                    ref={textareaRef}
                    value={creativeContent} 
                    onChange={handleContentChange} 
                    className="w-full p-5 pr-14 border border-gray-300 rounded-xl leading-relaxed text-[15px] text-gray-800 outline-none focus:ring-2 focus:ring-emerald-400 bg-white resize-none shadow-inner overflow-hidden"
                    style={{ minHeight: '200px' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        
        {creativeContent && !generateMut.isPending && (
          <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
            <button onClick={handleDownloadTxt} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 flex items-center gap-2 transition-colors shadow-sm"><Download className="w-4 h-4"/> 로컬 다운로드</button>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-8 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-md disabled:opacity-50 transition-colors">
              {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} DB 영구 저장
            </button>
          </div>
        )}
      </div>

      {isSourceModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center backdrop-blur-sm">
           <div className="bg-white rounded-2xl shadow-2xl w-[800px] h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                 <h2 className="font-extrabold text-xl flex items-center gap-2 text-gray-800">
                   <Search className="w-6 h-6 text-indigo-600"/> 원본 데이터 다중 불러오기
                 </h2>
                 <button onClick={() => setIsSourceModalOpen(false)} className="text-gray-400 hover:text-gray-800 transition-colors"><X className="w-6 h-6"/></button>
              </div>
              
              <div className="flex gap-4 p-4 border-b border-gray-200 shrink-0 bg-white">
                 <button onClick={() => setSourceSearchTab('LOG')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-colors ${sourceSearchTab === 'LOG' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>단기 일지 최근 내역</button>
                 <button onClick={() => setSourceSearchTab('BRIEFING')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-colors ${sourceSearchTab === 'BRIEFING' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>심층 리포트 최근 내역</button>
                 <button onClick={() => setSourceSearchTab('CREATION')} className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-colors ${sourceSearchTab === 'CREATION' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>2차 창작 최근 내역</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                 {sourceSearchTab === 'LOG' && (
                   <div className="flex flex-col gap-3">
                     {isLogsLoading ? (
                        <div className="py-20 flex justify-center text-indigo-500"><RefreshCw className="w-8 h-8 animate-spin"/></div>
                     ) : !recentLogs?.data || recentLogs.data.length === 0 ? (
                        <p className="text-center text-gray-400 font-bold py-20">최근 작성된 일지가 없습니다.</p>
                     ) : recentLogs.data.map((log: any) => {
                       const isSelected = tempSelectedSources.some(s => s.type === 'LOG' && s.id === log.log_id);
                       return (
                         <div 
                           key={log.log_id} 
                           onClick={() => toggleTempSelect('LOG', log.log_id, log.base_entity_id)} 
                           className={`p-4 bg-white border rounded-xl cursor-pointer transition-all shadow-sm flex gap-3 ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-gray-200 hover:border-indigo-300'}`}
                         >
                           <div className="pt-0.5">
                             <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                           </div>
                           <div className="flex-1">
                             <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">Log ID: {log.log_id} (Entity: {log.base_entity_id})</span>
                               <span className="text-xs font-bold text-gray-400">{log.log_date}</span>
                             </div>
                             <p className="text-sm text-gray-800 line-clamp-2 leading-relaxed font-medium">{log.llm_summary}</p>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}

                 {sourceSearchTab === 'BRIEFING' && (
                   <div className="flex flex-col gap-3">
                     {isBriefingsLoading ? (
                        <div className="py-20 flex justify-center text-indigo-500"><RefreshCw className="w-8 h-8 animate-spin"/></div>
                     ) : !recentBriefings?.data || recentBriefings.data.length === 0 ? (
                        <p className="text-center text-gray-400 font-bold py-20">최근 생성된 리포트가 없습니다.</p>
                     ) : recentBriefings.data.map((b: any) => {
                       const isSelected = tempSelectedSources.some(s => s.type === 'BRIEFING' && s.id === b.briefing_id);
                       return (
                         <div 
                           key={b.briefing_id} 
                           onClick={() => toggleTempSelect('BRIEFING', b.briefing_id, b.base_entity_id)} 
                           className={`p-4 bg-white border rounded-xl cursor-pointer transition-all shadow-sm flex gap-3 ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-gray-200 hover:border-indigo-300'}`}
                         >
                           <div className="pt-0.5">
                             <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                           </div>
                           <div className="flex-1">
                             <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Briefing ID: {b.briefing_id} (Entity: {b.base_entity_id})</span>
                               <span className="text-xs font-bold text-gray-400">{new Date(b.ne_ts).toLocaleDateString()}</span>
                             </div>
                             <p className="text-sm font-bold text-gray-900 mb-1">{b.query_text}</p>
                             <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed bg-gray-50 p-2 rounded">{b.executive_summary}</p>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}

                 {sourceSearchTab === 'CREATION' && (
                   <div className="flex flex-col gap-3">
                     {isCreationsLoading ? (
                        <div className="py-20 flex justify-center text-indigo-500"><RefreshCw className="w-8 h-8 animate-spin"/></div>
                     ) : !recentCreations?.data || recentCreations.data.length === 0 ? (
                        <p className="text-center text-gray-400 font-bold py-20">최근 생성된 창작물이 없습니다.</p>
                     ) : recentCreations.data.map((c: any) => {
                       const isSelected = tempSelectedSources.some(s => s.type === 'CREATION' && s.id === c.creation_id);
                       return (
                         <div 
                           key={c.creation_id} 
                           onClick={() => toggleTempSelect('CREATION', c.creation_id, c.base_entity_id)} 
                           className={`p-4 bg-white border rounded-xl cursor-pointer transition-all shadow-sm flex gap-3 ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-gray-200 hover:border-indigo-300'}`}
                         >
                           <div className="pt-0.5">
                             <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                           </div>
                           <div className="flex-1">
                             <div className="flex justify-between items-center mb-2">
                               <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2 py-1 rounded">Creation ID: {c.creation_id} (Entity: {c.base_entity_id})</span>
                               <span className="text-xs font-bold text-gray-400">{new Date(c.ne_ts).toLocaleDateString()}</span>
                             </div>
                             <div className="flex items-center gap-2 mb-1">
                               <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.tone_name}</span>
                             </div>
                             <p className="text-sm font-bold text-gray-900 mb-1">{c.creative_title}</p>
                             <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed bg-gray-50 p-2 rounded">{c.creative_content}</p>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
              </div>

              <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                 <div className="text-sm font-bold text-gray-700 flex items-center gap-2">
                   총 <span className="text-indigo-600 text-lg">{tempSelectedSources.length}</span>개 항목 선택됨
                 </div>
                 <div className="flex items-center gap-3">
                   <button onClick={() => setIsSourceModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors">취소</button>
                   <button onClick={confirmSelection} className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md">
                     <Database className="w-4 h-4" /> 일괄 불러오기
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}