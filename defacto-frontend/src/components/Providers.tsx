'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { setTargetLanguage } from '@/lib/api/client';

export default function Providers({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  // 💡 URL의 다국어 파라미터가 변경될 때마다 Axios 전역 헤더에 언어 설정을 주입합니다.
  useEffect(() => {
    setTargetLanguage(locale);
  }, [locale]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, 
            refetchOnWindowFocus: false, 
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