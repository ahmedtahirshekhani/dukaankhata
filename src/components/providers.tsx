'use client';

import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  locale: string;
  messages: any;
};

export function Providers({ children, locale, messages }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
