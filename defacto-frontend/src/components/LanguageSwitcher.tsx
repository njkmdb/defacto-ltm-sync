'use client';

import React, { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const switchLanguage = (newLocale: string) => {
    if (!pathname || locale === newLocale) return;
    const segments = pathname.split('/');
    segments[1] = newLocale; 
    startTransition(() => {
      router.push(segments.join('/'));
    });
  };

  return (
    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 opacity-90 hover:opacity-100 transition-opacity mr-2">
      <button 
        disabled={isPending}
        onClick={() => switchLanguage('ko')} 
        className={`px-3 py-1.5 text-[11px] font-extrabold rounded-md transition-colors ${locale === 'ko' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        KO
      </button>
      <button 
        disabled={isPending}
        onClick={() => switchLanguage('en')} 
        className={`px-3 py-1.5 text-[11px] font-extrabold rounded-md transition-colors ${locale === 'en' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        EN
      </button>
      <button 
        disabled={isPending}
        onClick={() => switchLanguage('ja')} 
        className={`px-3 py-1.5 text-[11px] font-extrabold rounded-md transition-colors ${locale === 'ja' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
      >
        JA
      </button>
    </div>
  );
}