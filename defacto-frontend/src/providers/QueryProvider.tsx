// src/providers/QueryProvider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState로 감싸서 컴포넌트 라이프사이클 동안 동일한 QueryClient 인스턴스를 유지합니다.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false, // 창 화면을 바꿨다 돌아와도 API 재호출 방지
        retry: 1, // 실패 시 1번만 재시도
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}