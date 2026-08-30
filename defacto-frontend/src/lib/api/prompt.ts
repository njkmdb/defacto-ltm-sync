import { apiClient } from './client';
import { PromptListResponse, SavePromptRequest } from '@/types/api';

export const getDefaultPrompts = async () => {
  const response = await apiClient.get('/api/v1/core/prompts/defaults');
  return response.data;
};

export const getPrompts = async (page: number = 1, limit: number = 20, targetType?: string, pipelineStep?: string): Promise<PromptListResponse> => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (targetType && targetType !== 'ALL') params.append('target_type', targetType);
  if (pipelineStep && pipelineStep !== 'ALL') params.append('pipeline_step', pipelineStep);
  
  const response = await apiClient.get(`/api/v1/core/prompts?${params.toString()}`);
  return response.data;
};

export const createPrompt = async (data: SavePromptRequest) => {
  const response = await apiClient.post('/api/v1/core/prompts', data);
  return response.data;
};

export const updatePrompt = async (promptId: number, data: SavePromptRequest) => {
  const response = await apiClient.patch(`/api/v1/core/prompts/${promptId}`, data);
  return response.data;
};

export const deletePrompt = async (promptId: number) => {
  const response = await apiClient.delete(`/api/v1/core/prompts/${promptId}`);
  return response.data;
};