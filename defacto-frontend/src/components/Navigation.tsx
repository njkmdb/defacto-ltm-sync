'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Activity, Archive, Database, BrainCircuit, Sparkles, Workflow } from 'lucide-react';

export default function Navigation({ locale }: { locale: string }) {
  const t = useTranslations('Navigation');
  const pathname = usePathname();

  // 💡 현재 브라우저의 URL 경로와 탭의 경로를 비교하여 Active 상태를 감지합니다.
  const isActive = (path: string) => {
    if (path === `/${locale}`) {
      return pathname === path; // 메인 대시보드는 정확히 일치할 때만 Active
    }
    return pathname.startsWith(path); // 하위 경로는 startsWith로 감지
  };

  return (
    <nav className="hidden lg:flex flex-1 items-center justify-center gap-2 mt-1 overflow-x-auto scrollbar-hide px-4">
      <Link 
        href={`/${locale}`} 
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
          isActive(`/${locale}`) 
            ? 'bg-gray-100 text-gray-900 shadow-sm' 
            : 'text-gray-800 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Activity className="w-4 h-4" /> {t('dashboard')}
      </Link>
      
      <Link 
        href={`/${locale}/builder`} 
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
          isActive(`/${locale}/builder`) 
            ? 'bg-blue-50 text-blue-700 shadow-sm' 
            : 'text-gray-800 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <Workflow className="w-4 h-4" /> {t('builder')}
      </Link>
      
      <Link 
        href={`/${locale}/archive`} 
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
          isActive(`/${locale}/archive`) 
            ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
            : 'text-gray-800 hover:text-indigo-700 hover:bg-indigo-50'
        }`}
      >
        <Archive className="w-4 h-4" /> {t('archive')}
      </Link>
      
      <Link 
        href={`/${locale}/memory`} 
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
          isActive(`/${locale}/memory`) 
            ? 'bg-orange-50 text-orange-700 shadow-sm' 
            : 'text-gray-800 hover:text-orange-700 hover:bg-orange-50'
        }`}
      >
        <BrainCircuit className="w-4 h-4" /> {t('memory')}
      </Link>
      
      <Link 
        href={`/${locale}/studio`} 
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
          isActive(`/${locale}/studio`) 
            ? 'bg-purple-50 text-purple-700 shadow-sm' 
            : 'text-gray-800 hover:text-purple-700 hover:bg-purple-50'
        }`}
      >
        <Sparkles className="w-4 h-4" /> {t('studio')}
      </Link>

      <Link 
        href={`/${locale}/domain`} 
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
          isActive(`/${locale}/domain`) 
            ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
            : 'text-gray-800 hover:text-emerald-700 hover:bg-emerald-50'
        }`}
      >
        <Database className="w-4 h-4" /> {t('domain')}
      </Link>
    </nav>
  );
}