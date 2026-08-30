import { apiClient } from './client';
import { MemorySearchRequest, GenerateBriefingRequest } from '@/types/api';

export const searchMemoryExplorer = async (data: MemorySearchRequest) => {
  const response = await apiClient.post('/api/v1/core/memory-search', data);
  return response.data;
};

export const generateEventBriefing = async (data: GenerateBriefingRequest) => {
  const response = await apiClient.post('/api/v1/core/generate-briefing', data);
  return response.data;
};

export const saveEventBriefing = async (data: any) => {
  const response = await apiClient.post('/api/v1/core/save-briefing', data);
  return response.data;
};

export const getEventBriefings = async (page: number = 1, limit: number = 20, baseEntityId?: number, startDate?: string, endDate?: string, searchConditions?: any[]) => {
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

  const response = await apiClient.get(`/api/v1/core/briefings?${params.toString()}`);
  return response.data;
};

export const getBriefingAuditTrail = async (briefingId: number, baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/briefings/${briefingId}/audit-trail?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const getEventBriefing = async (briefingId: number, baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/briefings/${briefingId}?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const updateEventBriefing = async (briefingId: number, data: any) => {
  const response = await apiClient.patch(`/api/v1/core/briefings/${briefingId}`, data);
  return response.data;
};

export const deleteEventBriefing = async (briefingId: number, baseEntityId: number) => {
  const response = await apiClient.delete(`/api/v1/core/briefings/${briefingId}?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const deleteBulkEventBriefings = async (briefingIds: number[], baseEntityId: number) => {
  const response = await apiClient.post('/api/v1/core/briefings/bulk-delete', { briefing_ids: briefingIds, base_entity_id: baseEntityId });
  return response.data;
};