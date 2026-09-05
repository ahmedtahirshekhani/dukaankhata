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
  if (amount === undefined || amount === null || isNaN(amount)) return "0";
  return `${Math.floor(amount)}`;
}

/**
 * Formats a currency amount with Pakistani numbering format and currency prefix
 * Example: formatCurrency(125000) => "Rs. 125,000"
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === "") return "Rs. 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "Rs. 0";
  return `Rs. ${Math.round(num).toLocaleString()}`;
}

/**
 * Generate a random/unique reference or payment number with a specified prefix.
 * Example: generateReferenceNumber("PAY-IN") => "PAY-IN-1725519400000-482"
 * Example: generateReferenceNumber("INV") => "INV-1725519400000-123"
 */
export function generateReferenceNumber(prefix: string = "REF"): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}`;
}

export const generatePaymentNumber = generateReferenceNumber;

export function formatCurrencyWithSuper(amount: number): { whole: string; decimal: string } {
  return {
    whole: `Rs. ${Math.floor(amount)}`,
    decimal: ''
  }
}

/**
 * Format date and time for display in account statement entry date column
 * Shows full date with time (e.g., "Feb 20, 2026, 10:30 AM")
 */
export function formatStatementDateTime(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Format date only (no time) for display in account statement
 * Shows only date (e.g., "Feb 20, 2026")
 */
export function formatStatementDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Set a date to midnight (00:00:00) UTC
 * Accepts a Date object or ISO string
 * Returns a new Date set to midnight
 */
export function setDateToMidnight(date: Date | string): Date {
  const dt = typeof date === 'string' ? new Date(date) : date;
  return new Date(Date.UTC(
    dt.getUTCFullYear(),
    dt.getUTCMonth(),
    dt.getUTCDate(),
    0, 0, 0, 0
  ));
}

/**
 * Set a date's year/month/day while preserving the current local time.
 * Useful for date-picker inputs where we want "today's time" instead of midnight.
 */
export function setDateToCurrentTime(date: Date | string): Date {
  const source = typeof date === "string" ? new Date(date) : date;
  const now = new Date();

  return new Date(
    source.getFullYear(),
    source.getMonth(),
    source.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
}

/**
 * Mask an invoice or payment reference number (e.g. INV-17182839210-456 -> INV-***-456, PAY-IN-17182839210-456 -> PAY-IN-***-456)
 */
export function maskInvoiceNo(invoiceNo: string): string {
  if (!invoiceNo) return "";
  const parts = invoiceNo.split('-');
  if (parts.length >= 3) {
    const middlePart = parts[parts.length - 2];
    if (/^\d{8,}$/.test(middlePart)) {
      const prefix = parts.slice(0, -2).join('-');
      const suffix = parts[parts.length - 1];
      return `${prefix}-***-${suffix}`;
    }
    const prefix = parts.slice(0, -2).join('-') || parts[0];
    const suffix = parts[parts.length - 1];
    return `${prefix}-***-${suffix}`;
  }
  if (invoiceNo.length > 8) {
    return invoiceNo.slice(0, 4) + "***" + invoiceNo.slice(-4);
  }
  return invoiceNo;
}

export const maskPaymentNo = maskInvoiceNo;
export const maskReferenceNo = maskInvoiceNo;
/**
 * Helper to get the canonical App base URL for generated email links.
 * Prefers custom domain (e.g. dukaankhata.app) from incoming request headers
 * or explicit process.env.APP_URL / process.env.NEXT_PUBLIC_APP_URL.
 */
export function getAppUrl(req?: Request): string {
  const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes("vercel.app")) {
    return envUrl.replace(/\/$/, "");
  }

  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || (host && !host.includes("localhost") ? "https" : "http");
    if (host && !host.includes("vercel.app")) {
      return `${proto}://${host}`;
    }
    if (host) {
      return `${proto}://${host}`;
    }
  }

  if (envUrl) return envUrl.replace(/\/$/, "");
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes("vercel.app")) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }

  return "https://www.dukaankhata.app";
}
