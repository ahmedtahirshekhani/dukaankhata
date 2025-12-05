'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getLanguagePreference, saveLanguagePreference } from '@/lib/language-storage';

export function LanguageInitializer() {
  const router = useRouter();
  const pathname = usePathname();

  // Extract locale from pathname (format: /locale/...)
  const locale = pathname.split('/')[1] || 'en';

  useEffect(() => {
    // Save current locale to localStorage whenever it changes
    saveLanguagePreference(locale);
  }, [locale]);

  useEffect(() => {
    // On first visit, check if user has a saved preference
    const savedLocale = getLanguagePreference();
    
    // Only redirect if user has a saved preference and it's different from current locale
    if (savedLocale && savedLocale !== locale) {
      const pathWithoutLocale = pathname.slice(locale.length + 1);
      router.push(`/${savedLocale}${pathWithoutLocale || '/'}`);
    }
  }, []); // Run only once on mount

  return null;
}
