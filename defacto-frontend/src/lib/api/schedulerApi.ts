import axios from 'axios';
const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080', headers: { 'Content-Type': 'application/json' } });

export const triggerBulkSynthesize = async (reference_date: string) => {
  const response = await apiClient.post('/api/v1/core/bulk-synthesize', { reference_date });
  return response.data;
};

export const getBatchJobStatus = async (jobId: string) => {
  const response = await apiClient.get(`/api/v1/core/batch-jobs/${jobId}`);
  return response.data;
};

export const forceExtSync = async () => {
  const response = await apiClient.post('/api/v1/core/scheduler/force-sync');
  return response.data;
};

export const getExtSyncHistory = async (limit: number = 5) => {
  const response = await apiClient.get(`/api/v1/core/scheduler/history?limit=${limit}`);
  return response.data;
};

export const getSchedulerConfig = async () => {
  const response = await apiClient.get('/api/v1/core/scheduler/config');
  return response.data;
};

export const updateSchedulerConfig = async (minutes: number, is_paused: boolean) => {
  const response = await apiClient.patch('/api/v1/core/scheduler/config', { minutes, is_paused });
  return response.data;
};