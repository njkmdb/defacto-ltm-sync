import axios from 'axios';
const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080', headers: { 'Content-Type': 'application/json' } });

export const getPipelineStatus = async ({ page = 1, limit = 20, startDate, endDate, statusFilter }: { page?: number; limit?: number; startDate?: string; endDate?: string; statusFilter?: string; } = {}) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (statusFilter && statusFilter !== 'ALL') params.append('status_filter', statusFilter);
  const response = await apiClient.get(`/api/v1/core/pipeline-status?${params.toString()}`);
  return response.data;
};

export const triggerStructureEvents = async (target_raw_ids: number[], base_entity_id: number, schema_name: string, retry_failed: boolean) => {
  const response = await apiClient.post('/api/v1/core/structure-events', { target_raw_ids, base_entity_id: base_entity_id || 1024, schema_name, retry_failed });
  return response.data;
};

export const triggerSynthesizeContext = async (base_entity_id: number, reference_date: string, use_deep_search: boolean = false) => {
  const response = await apiClient.post('/api/v1/core/synthesize-context', { base_entity_id: base_entity_id || 1024, reference_date, schema_name: "ContextSynthesisSchema", use_deep_search });
  return response.data;
};