import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

export const locales = ['en', 'ur', 'ru'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const locale = (await headers()).get('x-locale') || defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
