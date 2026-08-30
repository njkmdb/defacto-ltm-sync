import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ja', 'ko', 'en'],
  defaultLocale: 'ko'
});

export const config = {
  matcher: ['/', '/(ja|ko|en)/:path*']
};