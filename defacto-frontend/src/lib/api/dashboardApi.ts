import axios from 'axios';
const apiClient = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080', headers: { 'Content-Type': 'application/json' } });

// 💡 통계 조회 파라미터에 baseEntityId 추가
export const getDashboardStatistics = async (baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/statistics?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const getSystemInsights = async (baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/insights?base_entity_id=${baseEntityId}`);
  return response.data;
};