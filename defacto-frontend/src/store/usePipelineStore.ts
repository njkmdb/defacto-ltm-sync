import { create } from 'zustand';
import { PipelineStep } from '@/types/api';

interface PipelineState {
  nodes: PipelineStep[];
  selectedNodeId: string | null;
  addNode: (moduleName: string) => void;
  updateNodeParams: (nodeId: string, params: Record<string, any>) => void;
  updateNodeOutputKey: (nodeId: string, outputKey: string) => void;
  removeNode: (nodeId: string) => void;
  reorderNodes: (oldIndex: number, newIndex: number) => void;
  setSelectedNodeId: (id: string | null) => void;
  setNodes: (nodes: PipelineStep[]) => void;
  clearNodes: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  nodes: [],
  selectedNodeId: null,

  addNode: (moduleName) => set((state) => {
    const newNode: PipelineStep = {
      step_id: `node_${moduleName.toLowerCase()}_${Date.now()}`,
      step_order: state.nodes.length + 1,
      module_name: moduleName,
      params: {},
      output_key: `${moduleName.toLowerCase()}_result`
    };
    return { nodes: [...state.nodes, newNode], selectedNodeId: newNode.step_id };
  }),

  updateNodeParams: (nodeId, params) => set((state) => ({
    nodes: state.nodes.map(n => 
      n.step_id === nodeId ? { ...n, params: { ...n.params, ...params } } : n
    )
  })),

  updateNodeOutputKey: (nodeId, outputKey) => set((state) => ({
    nodes: state.nodes.map(n => 
      n.step_id === nodeId ? { ...n, output_key: outputKey } : n
    )
  })),

  removeNode: (nodeId) => set((state) => {
    const newNodes = state.nodes
      .filter(n => n.step_id !== nodeId)
      .map((n, i) => ({ ...n, step_order: i + 1 }));
    return {
      nodes: newNodes,
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
    };
  }),

  reorderNodes: (oldIndex, newIndex) => set((state) => {
    const newNodes = [...state.nodes];
    const [removed] = newNodes.splice(oldIndex, 1);
    newNodes.splice(newIndex, 0, removed);
    return { 
      nodes: newNodes.map((n, i) => ({ ...n, step_order: i + 1 })) 
    };
  }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setNodes: (nodes) => set({ nodes }),
  clearNodes: () => set({ nodes: [], selectedNodeId: null })
}));