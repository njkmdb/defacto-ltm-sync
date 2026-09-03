'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function useSourceTracker() {
  const router = useRouter();
  const locale = useLocale();

  const trackSource = (sourceType: string, sourceId: number, baseEntityId: number) => {
    if (sourceType === 'LOG') {
      router.push(`/${locale}/archive?tab=LOGS&focusId=${sourceId}&entityId=${baseEntityId}`);
    } else if (sourceType === 'BRIEFING') {
      router.push(`/${locale}/archive?tab=BRIEFINGS&focusId=${sourceId}&entityId=${baseEntityId}`);
    } else if (sourceType === 'CREATION') {
      router.push(`/${locale}/studio?tab=ARCHIVE&focusId=${sourceId}&entityId=${baseEntityId}`);
    } else {
      console.warn(`Unknown source type: ${sourceType}`);
    }
  };

  return { trackSource };
}