'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { X, Sparkles, RefreshCw, Save, Download, FileText, Wand2, Type, Database } from 'lucide-react';
import { generateCreativeContent, generateMetaPrompt, saveCreativeContent } from '@/lib/api/pipeline';
import { getPrompts, createPrompt } from '@/lib/api/prompt';
import { PromptItem } from '@/types/api';

interface CreativeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'LOG' | 'BRIEFING';
  sourceId: number;
  baseEntityId: number;
  sourceContent: string;
}

export default function CreativeStudioModal({ isOpen, onClose, sourceType, sourceId, baseEntityId, sourceContent }: CreativeStudioModalProps) {
  const t = useTranslations('Studio');
  const queryClient = useQueryClient();
  const [activeTone, setActiveTone] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [userIntent, setUserIntent] = useState<string>('');
  const [creativeTitle, setCreativeTitle] = useState<string>('');
  const [creativeContent, setCreativeContent] = useState<string>('');

  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxLength, setMaxLength] = useState<number>(1000);

  const { data: presets } = useQuery({
    queryKey: ['prompts', 1, 100, 'TONE_PRESET', 'C_CREATIVE'],
    queryFn: () => getPrompts(1, 100, 'TONE_PRESET', 'C_CREATIVE'),
    enabled: isOpen
  });

  const metaPromptMut = useMutation({
    mutationFn: async () => await generateMetaPrompt({ user_intent: userIntent }),
    onSuccess: (data) => {
      setActiveTone('CUSTOM');
      setSystemPrompt(data.data.suggested_prompt);
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_meta_fail'))
  });

  const generateMut = useMutation({
    mutationFn: async () => await generateCreativeContent({ 
      sources: [{ source_type: sourceType, source_id: sourceId }], 
      base_entity_id: baseEntityId,
      system_instruction: systemPrompt,
      temperature: temperature, 
      max_length: maxLength 
    }),
    onSuccess: (data) => {
      setCreativeContent(data.data.creative_content);
      setCreativeTitle(data.data.creative_title);
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_gen_fail'))
  });

  const saveMut = useMutation({
    mutationFn: async () => await saveCreativeContent({
      sources: [{ source_type: sourceType, source_id: sourceId }], 
      base_entity_id: baseEntityId,
      tone_name: activeTone || 'CUSTOM',
      creative_title: creativeTitle,
      creative_content: creativeContent
    }),
    onSuccess: (data) => {
      alert(data.message || t('alert_save_success'));
      queryClient.invalidateQueries({ queryKey: ['eventCreations'] });
      onClose();
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_save_fail'))
  });

  const savePresetMut = useMutation({
    mutationFn: async (presetName: string) => await createPrompt({
      target_type: 'TONE_PRESET',
      target_value: presetName,
      pipeline_step: 'C_CREATIVE',
      schema_name: 'CreativeContentSchema',
      system_prompt: systemPrompt,
      temperature: temperature, 
      max_length: maxLength, 
      is_active: true
    }),
    onSuccess: () => {
      alert(t('alert_preset_success'));
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || t('alert_preset_fail'))
  });

  const handleSavePreset = () => {
    const name = prompt(t('prompt_preset_name'));
    if (name && name.trim()) savePresetMut.mutate(name.trim());
  };

  const handleDownloadTxt = () => {
    const textData = `[${creativeTitle}]\n\n${creativeContent}`;
    const blob = new Blob(["\uFEFF" + textData], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Defacto_Creation_${sourceType}_${sourceId}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-50 rounded-2xl w-[1400px] max-w-[95vw] h-[90vh] flex shadow-2xl border border-gray-200 overflow-hidden">
        
        {/* COL 1: 원본 데이터 소스 */}
        <div className="w-[400px] bg-gray-100 flex flex-col border-r border-gray-200 shrink-0">
          <div className="p-4 bg-gray-200/50 border-b border-gray-200">
            <h3 className="font-bold flex items-center gap-2 text-gray-700"><Database className="w-4 h-4"/> {t('panel_1_title_modal')}</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border inline-flex items-center shadow-sm">
                 <FileText className="w-3 h-3 mr-1"/> {sourceType} #{sourceId}
               </span>
               <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded">Entity ID: {baseEntityId}</span>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex-1">
              {sourceContent}
            </div>
          </div>
        </div>
        
        {/* COL 2: 프롬프트 컨트롤 센터 */}
        <div className="w-[450px] bg-white flex flex-col border-r border-gray-200 shrink-0">
          <div className="p-4 bg-purple-50/50 border-b border-gray-200">
            <h3 className="font-bold flex items-center gap-2 text-purple-800"><Wand2 className="w-4 h-4"/> {t('panel_2_title')}</h3>
          </div>
          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-2 block">{t('label_preset_chip')}</label>
              <div className="flex flex-wrap gap-2">
                {presets?.data?.length === 0 && <span className="text-xs text-gray-400">{t('empty_preset')}</span>}
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
              <label className="text-xs font-bold text-gray-500 mb-2 block">{t('label_wizard')}</label>
              <div className="flex gap-2">
                <input type="text" value={userIntent} onChange={e => setUserIntent(e.target.value)} onKeyDown={e => e.key === 'Enter' && metaPromptMut.mutate()} placeholder={t('placeholder_intent')} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400 font-medium text-gray-700" />
                <button onClick={() => metaPromptMut.mutate()} disabled={metaPromptMut.isPending || !userIntent.trim()} className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg font-bold text-xs hover:bg-purple-200 transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1">
                  {metaPromptMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5"/>} {t('btn_draft')}
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col mt-2">
              <label className="text-xs font-bold text-gray-500 mb-2 block flex items-center justify-between">
                 {t('label_sys_prompt')}
                 <div className="flex items-center gap-2">
                   <button onClick={handleSavePreset} disabled={!systemPrompt.trim() || savePresetMut.isPending} className="text-[10px] bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1">
                     <Save className="w-3 h-3" /> {t('btn_save_my_preset')}
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
              </label>
              <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} className="flex-1 p-4 border border-gray-300 rounded-xl text-sm leading-relaxed outline-none focus:ring-2 focus:ring-purple-400 bg-gray-50 shadow-inner resize-none text-gray-800 font-medium" placeholder={t('placeholder_sys_prompt')}/>
            </div>
            <button onClick={() => generateMut.mutate()} disabled={generateMut.isPending || !systemPrompt.trim()} className="w-full py-3.5 bg-purple-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50 mt-2 shadow-md">
              {generateMut.isPending ? <RefreshCw className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5"/>} 🚀 {t('btn_start_creation', { count: 1 })}
            </button>
          </div>
        </div>

        {/* COL 3: 최종 결과물 */}
        <div className="flex-1 bg-white flex flex-col">
          <div className="p-4 bg-emerald-50/50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2 text-emerald-800"><FileText className="w-4 h-4"/> {t('panel_3_title_modal')}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-6 h-6"/></button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            {generateMut.isPending ? (
              <div className="flex-1 flex flex-col items-center justify-center text-purple-600">
                <RefreshCw className="w-12 h-12 animate-spin mb-4 text-purple-400"/>
                <p className="font-bold text-lg text-purple-800">{t('loading_reconstruct')}</p>
                <p className="text-sm font-semibold text-purple-500 mt-2 bg-purple-50 px-3 py-1 rounded-full">{t('loading_fact_check')}</p>
              </div>
            ) : !creativeContent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                <Type className="w-16 h-16 mb-4 text-gray-200"/>
                <p className="font-bold text-gray-400">{t('empty_result_title')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('empty_result_desc_modal')}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t('label_title')}</label>
                  <input type="text" value={creativeTitle} onChange={e => setCreativeTitle(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg font-extrabold text-xl text-gray-800 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm"/>
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                    {t('label_content_modal')}
                  </label>
                  <textarea 
                    value={creativeContent} 
                    onChange={(e) => setCreativeContent(e.target.value)} 
                    className="w-full p-5 border border-gray-300 rounded-xl leading-relaxed text-[15px] text-gray-800 outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50 resize-none shadow-inner overflow-y-auto h-64"
                  />
                </div>
              </>
            )}
          </div>
          {creativeContent && !generateMut.isPending && (
            <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={handleDownloadTxt} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 flex items-center gap-2 transition-colors shadow-sm">
                <Download className="w-4 h-4"/> {t('btn_download')}
              </button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="px-8 py-2.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-md disabled:opacity-50 transition-colors">
                {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t('btn_db_save')}
              </button>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}