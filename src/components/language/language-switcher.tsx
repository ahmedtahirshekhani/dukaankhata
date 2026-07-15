'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { saveLanguagePreference } from '@/lib/i18n/language-storage';
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

  const isDashboardPage = pathname === `/${locale}/admin` || pathname === `/${locale}/admin/`;

  const languages = [
    { value: 'en', label: t('english'), shortLabel: 'EN' },
    { value: 'ur', label: t('urdu'), shortLabel: 'UR' },
    { value: 'ru', label: t('romanUrdu'), shortLabel: 'RU' },
  ];

  const currentLang = languages.find((lang) => lang.value === locale);

  return (
    <Select value={locale} onValueChange={handleLanguageChange}>
      <SelectTrigger
        className={
          isDashboardPage
            ? "w-[60px] sm:w-[140px] md:w-[180px]"
            : "w-[100px] sm:w-[140px] md:w-[180px]"
        }
      >
        <SelectValue placeholder="Select language">
          {currentLang && (
            <>
              {isDashboardPage ? (
                <>
                  <span className="hidden sm:inline">{currentLang.label}</span>
                  <span className="sm:hidden">{currentLang.shortLabel}</span>
                </>
              ) : (
                <span>{currentLang.label}</span>
              )}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            {isDashboardPage ? (
              <>
                <span className="hidden sm:inline">{lang.label}</span>
                <span className="sm:hidden">{lang.shortLabel}</span>
              </>
            ) : (
              <span>{lang.label}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
