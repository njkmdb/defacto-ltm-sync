'use client';

import { useLocale } from 'next-intl';

export default function useLocaleFormatter() {
  const locale = useLocale();

  const getLocaleCode = () => {
    if (locale === 'ja') return 'ja-JP';
    if (locale === 'en') return 'en-US';
    return 'ko-KR';
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString(getLocaleCode(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(getLocaleCode());
  };

  const formatTimeOnly = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString(getLocaleCode(), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return { formatDateTime, formatDateOnly, formatTimeOnly, localeCode: getLocaleCode() };
}