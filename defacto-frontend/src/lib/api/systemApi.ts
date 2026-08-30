import { apiClient } from './client';

export const getSystemConfig = async () => {
  const response = await apiClient.get('/api/v1/core/system/config');
  return response.data;
};

export const getSystemTables = async (schemaName: string) => {
  const response = await apiClient.get(`/api/v1/core/system/tables/${schemaName}`);
  return response.data;
};

export const getSystemTableData = async (schemaName: string, tableName: string, page: number = 1, limit: number = 50, searchConditions?: any[]) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  
  if (searchConditions && searchConditions.length > 0) {
    const validConds = searchConditions.filter(c => c.keyword.trim() !== '');
    if (validConds.length > 0) {
      params.append('search_conditions', JSON.stringify(validConds));
    }
  }

  const response = await apiClient.get(`/api/v1/core/system/data/${schemaName}/${tableName}?${params.toString()}`);
  return response.data;
};

// 👇 [추가된 부분]
export const getSystemSettings = async () => {
  const response = await apiClient.get('/api/v1/core/system/settings');
  return response.data;
};

export const updateSystemSettings = async (api_key: string, model_name: string) => {
  const response = await apiClient.post('/api/v1/core/system/settings', { api_key, model_name });
  return response.data;
};