'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLanguagePreference } from '@/lib/i18n/language-storage';

export default function Home() {
  const router = useRouter();
  const preferredLanguage = getLanguagePreference() || 'en';

  useEffect(() => {
    // Redirect to English admin by default
    router.replace(`/${preferredLanguage || 'en'}/admin`);
  }, [router]);

  return null;
}
