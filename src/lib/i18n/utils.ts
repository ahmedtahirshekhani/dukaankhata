import { useTranslations, useLocale } from 'next-intl';

/**
 * Custom hook to get translations for a specific namespace
 * @param namespace - The translation namespace (e.g., 'products', 'auth')
 * @returns Translation function and current locale
 */
export function useI18n(namespace: string) {
  const t = useTranslations(namespace);
  const locale = useLocale();

  return {
    t,
    locale,
    isUrdu: locale === 'ur',
    isRomanUrdu: locale === 'ru',
    isEnglish: locale === 'en',
    isRTL: locale === 'ur',
  };
}

/**
 * Get text direction based on locale
 */
export function getTextDirection(locale: string): 'ltr' | 'rtl' {
  return locale === 'ur' ? 'rtl' : 'ltr';
}

/**
 * Format numbers according to locale
 */
export function formatLocaleNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(
    locale === 'ru' || locale === 'ur' ? 'ur-PK' : 'en-US',
    options
  ).format(value);
}

/**
 * Format currency according to locale
 */
export function formatLocaleCurrency(
  value: number,
  locale: string,
  currency: string = 'PKR'
): string {
  return new Intl.NumberFormat(
    locale === 'ru' || locale === 'ur' ? 'ur-PK' : 'en-US',
    {
      style: 'currency',
      currency,
    }
  ).format(value);
}

/**
 * Format date according to locale
 */
export function formatLocaleDate(
  date: Date | string,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(
    locale === 'ru' || locale === 'ur' ? 'ur-PK' : 'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options,
    }
  ).format(dateObj);
}
