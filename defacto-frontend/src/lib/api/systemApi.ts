import axios from 'axios';
const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080', headers: { 'Content-Type': 'application/json' } });

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