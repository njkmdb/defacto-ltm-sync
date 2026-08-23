import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Activity, Archive, Database, BrainCircuit, Beaker, Sparkles } from 'lucide-react';
import './globals.css';
import Providers from '@/components/Providers'; 

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Defacto LTM-Sync',
  description: '이벤트 기반 멀티모달 파이프라인 및 컨텍스트 관제 시스템',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50 text-gray-800`}>
        <Providers>
          <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-extrabold text-gray-900 tracking-tight">Defacto LTM</span>
                </Link>

                <nav className="hidden md:flex items-center gap-1 mt-1">
                  <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <Activity className="w-4 h-4" /> 파이프라인 관제
                  </Link>
                  <Link href="/archive" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <Archive className="w-4 h-4" /> 일지 보관소
                  </Link>
                  <Link href="/domain" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <Database className="w-4 h-4" /> 마스터 관리
                  </Link>
                  <Link href="/memory" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <BrainCircuit className="w-4 h-4" /> 기억 탐색기
                  </Link>
                  <Link href="/prompt" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
                    <Beaker className="w-4 h-4" /> 프롬프트 랩
                  </Link>
                  <Link href="/studio" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors">
                    <Sparkles className="w-4 h-4" /> 창작 스튜디오
                  </Link>
                </nav>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  ADMIN
                </div>
              </div>
            </div>
          </header>

          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}