'use client';

import React, { useState, useEffect } from 'react';
import { Settings, X, Save, RefreshCw, Key, Box } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemSettings, updateSystemSettings } from '@/lib/api/systemApi';
import { useLocale } from 'next-intl';

const TRANSLATIONS = {
  ko: {
    btn: "ADM",
    title: "시스템 환경 설정",
    desc: "Gemini API 키와 모델 버전을 동적으로 변경합니다.",
    apiKey: "Gemini API Key",
    modelName: "Model Name",
    placeholderKey: "AI Studio에서 발급받은 API 키 입력",
    placeholderModel: "예: auto 또는 gemini-3.6-flash",
    cancel: "취소",
    save: "저장하기",
    success: "설정이 성공적으로 저장되었습니다. 다음 파이프라인부터 즉시 적용됩니다.",
    error: "설정 저장에 실패했습니다."
  },
  en: {
    btn: "ADM",
    title: "System Settings",
    desc: "Dynamically change the Gemini API Key and Model Version.",
    apiKey: "Gemini API Key",
    modelName: "Model Name",
    placeholderKey: "Enter API key from AI Studio",
    placeholderModel: "e.g., auto or gemini-3.6-flash",
    cancel: "Cancel",
    save: "Save Changes",
    success: "Settings saved successfully. Changes apply to the next pipeline run immediately.",
    error: "Failed to save settings."
  },
  ja: {
    btn: "ADM",
    title: "システム環境設定",
    desc: "Gemini APIキーとモデルバージョンを動的に変更します。",
    apiKey: "Gemini API Key",
    modelName: "Model Name",
    placeholderKey: "AI Studioで発行されたAPIキーを入力",
    placeholderModel: "例: auto または gemini-3.6-flash",
    cancel: "キャンセル",
    save: "保存",
    success: "設定が正常に保存されました。次のパイプラインからすぐに適用されます。",
    error: "設定の保存に失敗しました。"
  }
};

export default function AdminMenu() {
  const locale = useLocale();
  const t = TRANSLATIONS[locale as keyof typeof TRANSLATIONS] || TRANSLATIONS['ko'];
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  
  const { data, isLoading } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: getSystemSettings,
    enabled: isOpen
  });

  useEffect(() => {
    if (data) {
      setApiKey(data.api_key || '');
      setModelName(data.model_name || '');
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => updateSystemSettings(apiKey, modelName),
    onSuccess: () => {
      alert(t.success);
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      setIsOpen(false);
    },
    onError: () => alert(t.error)
  });

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 transition-colors border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0 shadow-sm cursor-pointer"
        title="Admin Settings"
      >
        {t.btn}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[500px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" /> {t.title}
                </h2>
                <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              {isLoading ? (
                <div className="flex justify-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-indigo-500" /></div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5"><Key className="w-4 h-4 text-gray-400" /> {t.apiKey}</label>
                    <input 
                      type="password" 
                      value={apiKey} 
                      onChange={(e) => setApiKey(e.target.value)} 
                      placeholder={t.placeholderKey}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium bg-gray-50 focus:bg-white transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5"><Box className="w-4 h-4 text-gray-400" /> {t.modelName}</label>
                    <input 
                      type="text" 
                      value={modelName} 
                      onChange={(e) => setModelName(e.target.value)} 
                      placeholder={t.placeholderModel}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium bg-gray-50 focus:bg-white transition-colors" 
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">{t.cancel}</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-colors disabled:opacity-50">
                {saveMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}