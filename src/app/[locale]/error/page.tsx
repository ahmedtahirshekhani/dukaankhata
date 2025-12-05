'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function ErrorPage() {
  const t = useTranslations('error');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">{t('pageTitle')}</h1>
      <p className="text-lg mb-8">{t('message')}</p>
      <div className="flex gap-4">
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          {t('tryAgain')}
        </button>
        <Link href="/" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}