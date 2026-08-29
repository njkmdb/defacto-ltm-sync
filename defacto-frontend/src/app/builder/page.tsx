'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Workflow, Play, Save, FolderOpen, RefreshCw, Trash2, FileJson } from 'lucide-react';
import { usePipelineStore } from '@/store/usePipelineStore';
import { executeDynamicPipeline, getPipelinePresets, createPipelinePreset, updatePipelinePreset } from '@/lib/api/pipeline';
import NodePalette from '@/components/builder/NodePalette';
import PipelineCanvas from '@/components/builder/PipelineCanvas';
import PropertyEditor from '@/components/builder/PropertyEditor';

export default function PipelineBuilderPage() {
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
      alert("파이프라인이 성공적으로 저장되었습니다.");
      queryClient.invalidateQueries({ queryKey: ['pipelinePresets'] });
    },
    onError: (err: any) => alert(err.response?.data?.detail || "저장에 실패했습니다.")
  });

  const executeMut = useMutation({
    mutationFn: async () => {
      let parsedContext = {};
      try { parsedContext = JSON.parse(initialContext); } catch (e) { throw new Error("초기 Context가 올바른 JSON이 아닙니다."); }

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
    onError: (err: any) => alert(err.response?.data?.detail || err.message || "실행 중 오류가 발생했습니다.")
  });

  const handleSave = () => {
    if (nodes.length === 0) return alert("저장할 노드가 없습니다.");
    savePresetMut.mutate();
  };

  const handleExecute = () => {
    if (nodes.length === 0) return alert("실행할 노드가 없습니다.");
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
    <main className="min-h-screen bg-gray-50 p-8 text-gray-800 relative pb-20 flex flex-col h-screen overflow-hidden">
      <header className="mb-6 border-b border-gray-200 pb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Workflow className="w-8 h-8 text-blue-600" /> 비주얼 파이프라인 빌더
          </h1>
          <p className="text-sm text-gray-500 mt-2">백엔드 로직 수정 없이 UI에서 모듈을 조립하여 새로운 시스템의 동작 흐름을 무한히 생성합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { clearNodes(); setPipelineId(''); setPipelineName(''); setDescription(''); }} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm">
            <Trash2 className="w-4 h-4" /> 캔버스 초기화
          </button>
          
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1.5 shadow-sm">
            <FolderOpen className="w-4 h-4 text-gray-400 ml-1" />
            <select onChange={handleLoadPreset} className="text-sm font-bold text-gray-700 outline-none cursor-pointer bg-transparent">
              <option value="">프리셋 불러오기...</option>
              {presets?.data?.map((p: any) => (
                <option key={p.pipeline_id} value={p.pipeline_id}>{p.pipeline_name}</option>
              ))}
            </select>
          </div>

          <button onClick={handleSave} disabled={savePresetMut.isPending} className="px-5 py-2 bg-gray-900 text-white hover:bg-black rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md">
            {savePresetMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} 프리셋 저장
          </button>
        </div>
      </header>

      <div className="flex gap-4 mb-4 shrink-0 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1 border-r border-gray-200 pr-4">
          <label className="text-xs font-bold text-gray-500">Pipeline Name / Description</label>
          <div className="flex gap-2">
            <input type="text" placeholder="파이프라인 이름" value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} className="w-1/3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 outline-none focus:border-blue-400" />
            <input type="text" placeholder="설명" value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600 outline-none focus:border-blue-400" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <label className="text-xs font-bold text-gray-500">Execution Test (Runtime Params)</label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Target Entity:</span>
            <input type="number" value={testEntityId} onChange={e => setTestEntityId(Number(e.target.value))} className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-800 outline-none focus:border-blue-400"/>
            <input type="text" value={initialContext} onChange={e => setInitialContext(e.target.value)} placeholder="Initial Context JSON" className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-blue-400" />
            
            <button onClick={handleExecute} disabled={executeMut.isPending} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-md">
              {executeMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current" />} 실행 (Dry Run)
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
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2"><FileJson className="w-5 h-5 text-blue-400"/> 파이프라인 실행 결과 (Final State)</h2>
              <button onClick={() => setIsTestModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">닫기</button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
              <pre className="text-xs text-gray-800 bg-white p-4 rounded-xl border border-gray-200 shadow-inner whitespace-pre-wrap font-mono">
                {JSON.stringify(executionResult, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}