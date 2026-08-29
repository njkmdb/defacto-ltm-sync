import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080',
  headers: { 'Content-Type': 'application/json' },
});

export const saveContextSummary = async (base_entity_id: number, reference_date: string, edited_summary: string, action_items: any[], logId?: number, schema_name: string = "LTM_Synthesis") => {
  const payload: any = { base_entity_id: base_entity_id || 1024, reference_date, edited_summary, action_items, schema_name };
  if (logId) payload.log_id = logId;
  const response = await apiClient.post('/api/v1/core/save-summary', payload);
  return response.data;
};

export const getEventLogs = async (page: number = 1, limit: number = 20, startDate?: string, endDate?: string, searchConditions?: any[]) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  
  if (searchConditions && searchConditions.length > 0) {
    const validConds = searchConditions.filter(c => c.keyword.trim() !== '');
    if (validConds.length > 0) {
      params.append('search_conditions', JSON.stringify(validConds));
    }
  }
  
  const response = await apiClient.get(`/api/v1/core/event-logs?${params.toString()}`);
  return response.data;
};

export const deleteEventLog = async (logId: number, baseEntityId: number) => {
  const response = await apiClient.delete(`/api/v1/core/event-logs/${logId}?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const deleteBulkEventLogs = async (logIds: number[], baseEntityId: number) => {
  const response = await apiClient.post('/api/v1/core/event-logs/bulk-delete', { log_ids: logIds, base_entity_id: baseEntityId });
  return response.data;
};

export const bulkUpsertEventLogs = async (data: any[]) => {
  const response = await apiClient.post('/api/v1/core/event-logs/bulk-upsert', { items: data });
  return response.data;
};

export const getEventLog = async (logId: number, baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/event-logs/${logId}?base_entity_id=${baseEntityId}`);
  return response.data;
};