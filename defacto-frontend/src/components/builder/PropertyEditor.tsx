'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, Save, Info } from 'lucide-react';
import { usePipelineStore } from '@/store/usePipelineStore';

export default function PropertyEditor() {
  const t = useTranslations('Builder');
  const { nodes, selectedNodeId, updateNodeParams, updateNodeOutputKey } = usePipelineStore();
  const selectedNode = nodes.find(n => n.step_id === selectedNodeId);

  const [localParamsStr, setLocalParamsStr] = useState('{}');
  const [localOutputKey, setLocalOutputKey] = useState('');

  useEffect(() => {
    if (selectedNode) {
      setLocalParamsStr(JSON.stringify(selectedNode.params, null, 2));
      setLocalOutputKey(selectedNode.output_key);
    }
  }, [selectedNodeId, selectedNode?.params, selectedNode?.output_key]);

  if (!selectedNode) {
    return (
      <div className="w-[450px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col shrink-0 items-center justify-center text-gray-400">
        <Settings className="w-10 h-10 mb-3 text-gray-200" />
        <p className="font-bold text-sm">{t('prop_empty')}</p>
      </div>
    );
  }

  const handleApplyParams = () => {
    try {
      const parsed = JSON.parse(localParamsStr);
      updateNodeParams(selectedNode.step_id, parsed);
      updateNodeOutputKey(selectedNode.step_id, localOutputKey);
      alert(t('alert_prop_apply'));
    } catch (e) {
      alert(t('alert_prop_json'));
    }
  };

  const insertVariable = (variable: string) => {
    try {
      const currentObj = JSON.parse(localParamsStr);
      const newObj = { ...currentObj, inserted_var: `{{${variable}}}` };
      setLocalParamsStr(JSON.stringify(newObj, null, 2));
    } catch (e) {
      setLocalParamsStr(`{\n  "inserted_var": "{{${variable}}}"\n}`);
    }
  };

  return (
    <div className="w-[450px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col shrink-0 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-700 flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600"/> {t('prop_title')}
        </h2>
        <span className="text-[10px] font-bold text-white bg-gray-800 px-2 py-0.5 rounded">{selectedNode.module_name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">{t('prop_output_key')}</label>
          <input 
            type="text" 
            value={localOutputKey} 
            onChange={e => setLocalOutputKey(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50/30"
          />
          <p className="text-[10px] text-gray-400 mt-1">{t('prop_output_desc')}</p>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-gray-600 uppercase">{t('prop_params')}</label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">{t('prop_var_inject')}</span>
              <button onClick={() => insertVariable('initial_context.query_text')} className="px-1.5 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded font-mono border border-gray-200 transition-colors">Query</button>
              <button onClick={() => insertVariable('initial_context.reference_date')} className="px-1.5 py-0.5 text-[10px] bg-gray-100 hover:bg-gray-200 rounded font-mono border border-gray-200 transition-colors">Date</button>
            </div>
          </div>
          <textarea 
            value={localParamsStr}
            onChange={e => setLocalParamsStr(e.target.value)}
            className="w-full h-80 border border-gray-300 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 leading-relaxed text-gray-800 resize-none shadow-inner"
          />
          <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-blue-800 leading-relaxed font-medium">
              <strong className="block mb-1 text-xs">{t('prop_bind_guide')}</strong>
              <br/>
              <code className="bg-white px-1 py-0.5 rounded border border-blue-200 mr-1">{`"{{node_output_key}}"`}</code> {t('prop_bind_desc')}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
        <button onClick={handleApplyParams} className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold flex justify-center items-center gap-2 shadow-md transition-colors">
          <Save className="w-4 h-4" /> {t('prop_apply')}
        </button>
      </div>
    </div>
  );
}