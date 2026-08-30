import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080',
  headers: { 'Content-Type': 'application/json' },
});

export const setTargetLanguage = (locale: string) => {
  let lang = 'Korean';
  if (locale === 'ja') lang = 'Japanese';
  if (locale === 'en') lang = 'English';
  
  // 모든 후속 API 요청의 헤더에 다국어 라우트 정보를 주입합니다.
  apiClient.defaults.headers.common['x-target-language'] = lang;
};