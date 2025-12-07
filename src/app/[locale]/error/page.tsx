'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function ErrorPage() {
  const t = useTranslations('error');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">{t('pageTitle')}</h1>
      <p className="text-lg mb-4">{t('message')}</p>

      <div className="w-full max-w-xl border rounded-lg p-4 mb-6">
        <p className="font-semibold mb-2">Contact the owner</p>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="font-medium">WhatsApp: </span>
            <a
              href="https://wa.me/491786141157"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              +49 178 6141157 (Ahmed Tahir Shekhani) - Germany
              +92 3352575725 (M. Kashan Shekhani) - Pakistan
            </a>
          </li>
          <li>
            <span className="font-medium">LinkedIn: </span>
            <a
              href="https://www.linkedin.com/in/ahmedtahirshekhani/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              linkedin.com/in/ahmedtahirshekhani/
            </a>
          </li>
          <li>
            <span className="font-medium">Email: </span>
            <a
              href="mailto:ahmedtahir.developer@gmail.com"
              className="text-blue-600 hover:underline"
            >
              ahmedtahir.developer@gmail.com
            </a>
          </li>
          <li>
            <span className="font-medium">Phone (Pakistan): </span>
            <a href="tel:+923352575725" className="text-blue-600 hover:underline">
              +92 3352575725 (M. Kashan Shekhani)
            </a>
          </li>
        </ul>
      </div>

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