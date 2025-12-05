'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { saveLanguagePreference } from '@/lib/language-storage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('language');

  const handleLanguageChange = (newLocale: string) => {
    saveLanguagePreference(newLocale);
    const pathWithoutLocale = pathname.slice(locale.length + 1);
    router.push(`/${newLocale}${pathWithoutLocale || '/'}`);
  };

  const languages = [
    { value: 'en', label: t('english') },
    { value: 'ur', label: t('urdu') },
    { value: 'ru', label: t('romanUrdu') },
  ];

  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select language" />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
