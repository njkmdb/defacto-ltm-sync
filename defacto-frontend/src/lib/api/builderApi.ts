import axios from 'axios';
import { 
  PipelineExecutionRequest, 
  PipelineExecutionResponse, 
  PipelinePresetListResponse,
  CreatePipelinePresetRequest,
  UpdatePipelinePresetRequest
} from '@/types/api';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080',
  headers: { 'Content-Type': 'application/json' },
});

export const executeDynamicPipeline = async (data: PipelineExecutionRequest): Promise<PipelineExecutionResponse> => {
  const response = await apiClient.post('/api/v1/core/builder/execute', data);
  return response.data;
};

export const getPipelinePresets = async (page: number = 1, limit: number = 20, isActive?: boolean): Promise<PipelinePresetListResponse> => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (isActive !== undefined) params.append('is_active', String(isActive));
  const response = await apiClient.get(`/api/v1/core/builder/presets?${params.toString()}`);
  return response.data;
};

export const createPipelinePreset = async (data: CreatePipelinePresetRequest) => {
  const response = await apiClient.post('/api/v1/core/builder/presets', data);
  return response.data;
};

export const updatePipelinePreset = async (pipelineId: string, data: UpdatePipelinePresetRequest) => {
  const response = await apiClient.patch(`/api/v1/core/builder/presets/${pipelineId}`, data);
  return response.data;
};

export const deletePipelinePreset = async (pipelineId: string) => {
  const response = await apiClient.delete(`/api/v1/core/builder/presets/${pipelineId}`);
  return response.data;
};