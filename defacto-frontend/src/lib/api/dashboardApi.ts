import { apiClient } from './client';

export const getDashboardStatistics = async (baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/statistics?base_entity_id=${baseEntityId}`);
  return response.data;
};

export const getSystemInsights = async (baseEntityId: number) => {
  const response = await apiClient.get(`/api/v1/core/insights?base_entity_id=${baseEntityId}`);
  return response.data;
};