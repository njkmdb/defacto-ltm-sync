import axios from 'axios';
const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080', headers: { 'Content-Type': 'application/json' } });

export const createRawEvent = async (data: { base_entity_id: number; event_date: string; raw_content: string; run_pipeline_now: boolean; schema_name: string; }) => {
  const response = await apiClient.post('/api/v1/core/raw-events', { ...data, base_entity_id: data.base_entity_id || 1024 });
  return response.data;
};

export const updateRawEvent = async (rawId: number, data: { base_entity_id?: number; event_date: string; raw_content: string; run_pipeline_now: boolean; schema_name: string; }) => {
  const response = await apiClient.patch(`/api/v1/core/raw-events/${rawId}`, data);
  return response.data;
};

export const deleteRawEvent = async (rawId: number) => {
  const response = await apiClient.delete(`/api/v1/core/raw-events/${rawId}`);
  return response.data;
};

export const deleteBulkRawEvents = async (rawIds: number[]) => {
  const response = await apiClient.post('/api/v1/core/raw-events/bulk-delete', { raw_ids: rawIds });
  return response.data;
};