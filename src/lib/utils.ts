import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Detect the user's timezone reliably.
// - On the client (browser), use Intl API.
// - On the server (SSR), fall back to Pakistan (Asia/Karachi) unless overridden.
export function getUserTimeZone(fallback: string = 'Asia/Karachi'): string {
  try {
    if (typeof window !== 'undefined') {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz && typeof tz === 'string') return tz
    }
  } catch (_) {
    // ignore and use fallback
  }
  return fallback
}



// Format a date in the user's local timezone. Accepts a Date object or an ISO string.
// By default, formats date only (no time). Pass options to customize formatting.
export function formatDate(
  date: Date | string,
  iSCurrentTime?: boolean,
  options?: Intl.DateTimeFormatOptions
) {
  const tz = getUserTimeZone()
  const dt = typeof date === 'string' ? new Date(date) : date
  let timezoneDt = dt.getTime() 
  if (!iSCurrentTime) {
    timezoneDt = timezoneDt - (dt.getTimezoneOffset() * 60000);
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    ...options,
  }).format(timezoneDt)
}

// Convert any Date (assumed local) to a UTC ISO string suitable for DB storage.
export function toUTCISOString(date: Date): string {
  return new Date(date.getTime()).toISOString()
}

// Parse an ISO string (assumed UTC) to a Date object.
export function fromUTC(iso: string): Date {
  return new Date(iso)
}

// Convenience: format directly from a UTC ISO string using the user's timezone.
export function formatDateFromUTC(
  utcIso: string,
  options?: Intl.DateTimeFormatOptions
) {
  return formatDate(fromUTC(utcIso), false, options)
}

export function getYearsFromDates(dates: (Date | string)[]): number[] {
  const years = new Set<number>()
  dates.forEach(date => {
    if (typeof date === 'string') {
      date = new Date(date)
    }
    years.add(date.getFullYear())
  })
  return Array.from(years).sort((a, b) => b - a) // Sort descending, current year first
}

export function formatCurrencyString(amount: number): string {
  return `Rs. ${Math.floor(amount)}`
}

export function formatCurrencyWithSuper(amount: number): { whole: string; decimal: string } {
  return {
    whole: `Rs. ${Math.floor(amount)}`,
    decimal: ''
  }
}