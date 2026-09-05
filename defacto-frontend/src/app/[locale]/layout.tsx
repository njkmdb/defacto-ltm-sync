import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import '@/app/globals.css';
import Providers from '@/components/Providers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Navigation from '@/components/Navigation';
import AdminMenu from '@/components/AdminMenu';
import FloatingGuideBot from '@/components/FloatingGuideBot';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return {
    title: 'Defacto LTM-Sync',
    description: t('meta_description'),
  };
}

export function generateStaticParams() {
  return [{ locale: 'ja' }, { locale: 'ko' }, { locale: 'en' }];
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  if (!['ja', 'ko', 'en'].includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-gray-50 text-gray-800`}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
              <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
                
                <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-extrabold text-gray-900 tracking-tight whitespace-nowrap">Defacto LTM</span>
                </Link>

                <Navigation locale={locale} />
                
                <div className="flex items-center shrink-0">
                  <LanguageSwitcher />
                  <AdminMenu />
                </div>
              </div>
            </header>

            <div className="max-w-[1600px] mx-auto">
              {children}
            </div>

            <FloatingGuideBot />
            
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}