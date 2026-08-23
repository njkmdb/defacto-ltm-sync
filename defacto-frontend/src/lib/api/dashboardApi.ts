import axios from 'axios';
const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080', headers: { 'Content-Type': 'application/json' } });

export const getDashboardStatistics = async () => {
  const response = await apiClient.get(`/api/v1/core/statistics`);
  return response.data;
};

export const getSystemInsights = async () => {
  const response = await apiClient.get('/api/v1/core/insights');
  return response.data;
};