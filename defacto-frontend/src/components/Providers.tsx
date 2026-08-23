'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function Providers({ children }: { children: React.ReactNode }) {
  // 💡 컴포넌트가 재렌더링되더라도 QueryClient가 초기화되지 않도록 useState로 상태 유지
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분간 캐시 유지
            refetchOnWindowFocus: false, // 탭 전환 시 불필요한 자동 새로고침 방지
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}