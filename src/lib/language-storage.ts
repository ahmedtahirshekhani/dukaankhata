const LANGUAGE_STORAGE_KEY = 'preferred-language';

export function saveLanguagePreference(locale: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
  }
}

export function getLanguagePreference(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  }
  return null;
}

export function clearLanguagePreference(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  }
}
