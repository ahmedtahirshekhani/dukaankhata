import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'ur', 'ru'];

export default getRequestConfig(async () => {
  // Get locale from headers or use default
  const locale = 'en';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
