import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080',
});

export const uploadMediaFile = async (file: File, baseEntityId: number) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('base_entity_id', baseEntityId.toString());

  const response = await apiClient.post('/api/v1/media/upload', formData, {
    headers: { 'Content-Type': undefined } // 브라우저가 boundary를 자동 설정하도록 undefined 유지
  });
  return response.data;
};