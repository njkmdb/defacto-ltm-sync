import { apiClient } from './client';
import { ChatRequest, ChatApiResponse } from '@/types/api';

export const sendChatMessage = async (data: ChatRequest): Promise<ChatApiResponse> => {
  const response = await apiClient.post('/api/v1/core/chat', {
    ...data,
    base_entity_id: data.base_entity_id || 1024
  });
  return response.data;
};