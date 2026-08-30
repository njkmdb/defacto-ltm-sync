import { apiClient } from './client';
import { GenerateCreativeRequest, GenerateMetaPromptRequest, SaveCreativeRequest, EventCreationListResponse } from '@/types/api';

export const generateCreativeContent = async (data: GenerateCreativeRequest) => {
  const response = await apiClient.post('/api/v1/core/creative/generate', data);
  return response.data;
};

export const generateMetaPrompt = async (data: GenerateMetaPromptRequest) => {
  const response = await apiClient.post('/api/v1/core/meta-prompt', data);
  return response.data;
};

export const saveCreativeContent = async (data: SaveCreativeRequest) => {
  const response = await apiClient.post('/api/v1/core/creative/save', data);
  return response.data;
};

export const getEventCreations = async (page: number = 1, limit: number = 20, baseEntityId?: number, startDate?: string, endDate?: string, searchConditions?: any[]): Promise<EventCreationListResponse> => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (baseEntityId) params.append('base_entity_id', baseEntityId.toString());
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  if (searchConditions && searchConditions.length > 0) {
    const validConds = searchConditions.filter(c => c.keyword.trim() !== '');
    if (validConds.length > 0) {
      params.append('search_conditions', JSON.stringify(validConds));
    }
  }

  const response = await apiClient.get(`/api/v1/core/creative?${params.toString()}`);
  return response.data;
};

export const deleteEventCreation = async (creationId: number, baseEntityId: number) => {
  const response = await apiClient.delete(`/api/v1/core/creative/${creationId}?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const getEventCreation = async (creationId: number, baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/creative/${creationId}?base_entity_id=${baseEntityId}`);
  return response.data;
};