/**
 * Utility functions for handling dates safely across the application with Pakistani (DD-MM-YYYY) format
 * and Pakistan Standard Time (Asia/Karachi, UTC+05:00) support.
 */

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+05:00 (Pakistan Standard Time)

/**
 * Extracts calendar date and time components in Pakistan Standard Time (UTC+05:00).
 * Ensures consistent date extraction whether running on a PKT client or a UTC cloud server.
 */
export function getPKTParts(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;

    // Direct match for DD-MM-YYYY or DD/MM/YYYY
    const pkMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (pkMatch) {
      const [, d, m, y] = pkMatch;
      return {
        year: Number(y),
        month: Number(m),
        day: Number(d),
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
    }

    // Direct match for YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return {
        year: Number(y),
        month: Number(m),
        day: Number(d),
        hours: 0,
        minutes: 0,
        seconds: 0,
      };
    }
  }

  const d = dateInput instanceof Date ? dateInput : new Date(String(dateInput).trim());
  if (!d || isNaN(d.getTime())) return null;

  // Shift instant by +05:00 and read UTC getters to get exact Asia/Karachi wall-clock components
  const pktDate = new Date(d.getTime() + PKT_OFFSET_MS);
  return {
    year: pktDate.getUTCFullYear(),
    month: pktDate.getUTCMonth() + 1,
    day: pktDate.getUTCDate(),
    hours: pktDate.getUTCHours(),
    minutes: pktDate.getUTCMinutes(),
    seconds: pktDate.getUTCSeconds(),
  };
}

// Formats a Date object or string to YYYY-MM-DD string for HTML inputs (in Pakistani Time)
export function toHTMLDateString(date: Date | string | undefined | null): string {
  if (!date) return "";
  const parts = getPKTParts(date);
  if (!parts) return "";

  const year = parts.year;
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Formats a Date object or string to DD-MM-YYYY string for Pakistani display
export function toPakistaniDateString(date: Date | string | undefined | null, separator: "-" | "/" = "-"): string {
  if (!date) return "";
  const parts = getPKTParts(date);
  if (!parts) return "";

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  const year = parts.year;

  return `${day}${separator}${month}${separator}${year}`;
}

// Safely creates a Date object from a string (supports DD-MM-YYYY, YYYY-MM-DD, ISO) or returns a fallback date
export function safeDate(dateString: string | Date | undefined | null, fallback = new Date()): Date {
  if (!dateString) return fallback;
  if (dateString instanceof Date) return isNaN(dateString.getTime()) ? fallback : dateString;

  const trimmed = String(dateString).trim();
  if (!trimmed) return fallback;

  // Check for DD-MM-YYYY or DD/MM/YYYY (Pakistani format)
  const pkMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (pkMatch) {
    const [, d, m, y] = pkMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? fallback : date;
  }

  // Check for YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date.getTime()) ? fallback : date;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

// Formats a date to Pakistani readable format: DD-MM-YYYY (e.g., "14-09-2026")
export function formatReadableDate(date: string | Date | undefined | null): string {
  if (!date) return "-";
  const parsed = safeDate(date, new Date(0));
  if (parsed.getTime() === 0) return "-";

  const parts = getPKTParts(date);
  if (!parts) return "-";

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  const year = parts.year;

  return `${day}-${month}-${year}`;
}

// Formats a date and time to Pakistani readable format: DD-MM-YYYY, hh:mm A (e.g., "14-09-2026, 12:00 PM")
export function formatReadableDateTime(date: string | Date | undefined | null): string {
  if (!date) return "-";
  const parsed = safeDate(date, new Date(0));
  if (parsed.getTime() === 0) return "-";

  const parts = getPKTParts(parsed);
  if (!parts) return "-";

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  const year = parts.year;

  let hours = parts.hours;
  const minutes = String(parts.minutes).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursFormatted = String(hours).padStart(2, "0");

  return `${day}-${month}-${year}, ${hoursFormatted}:${minutes} ${ampm}`;
}

// Formats a date to Pakistani format: DD-MM-YYYY, with optional time: DD-MM-YYYY, hh:mm:ss A
export function formatPakistaniDateTime(
  date: string | Date | undefined | null,
  isTime: boolean = false,
  includeSeconds: boolean = true
): string {
  if (!date) return "-";
  const parsed = safeDate(date, new Date(0));
  if (parsed.getTime() === 0) return "-";

  const parts = getPKTParts(date);
  if (!parts) return "-";

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  const year = parts.year;

  if (!isTime) {
    return `${day}-${month}-${year}`;
  }

  let hours = parts.hours;
  const minutes = String(parts.minutes).padStart(2, "0");
  const seconds = String(parts.seconds).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursFormatted = String(hours).padStart(2, "0");

  if (includeSeconds) {
    return `${day}-${month}-${year}, ${hoursFormatted}:${minutes}:${seconds} ${ampm}`;
  }
  return `${day}-${month}-${year}, ${hoursFormatted}:${minutes} ${ampm}`;
}

// Returns today's date in Pakistan (Asia/Karachi) formatted for an HTML input (YYYY-MM-DD)
export function getTodayHTMLDate(): string {
  return toHTMLDateString(new Date());
}

// Returns a date N days ago in Pakistan formatted for an HTML input (YYYY-MM-DD)
export function getDaysAgoHTMLDate(days: number): string {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return toHTMLDateString(date);
}

/**
 * Safely converts a date input (YYYY-MM-DD, DD-MM-YYYY, ISO string, or Date)
 * to a standardized UTC ISO string anchored at 12:00:00 UTC (Midday UTC).
 *
 * Why 12:00:00 UTC?
 * Across all timezones worldwide (UTC-11 to UTC+12), Midday UTC is guaranteed
 * to NEVER cross midnight into the previous or next day, permanently preventing
 * timezone shifting bugs when saving and viewing dates.
 */
export function toSafeISOString(date: string | Date | undefined | null): string {
  if (!date) {
    const todayParts = getPKTParts(new Date());
    if (todayParts) {
      return new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 12, 0, 0, 0)).toISOString();
    }
    return new Date().toISOString();
  }

  if (date instanceof Date) {
    if (isNaN(date.getTime())) return new Date().toISOString();
    const parts = getPKTParts(date);
    if (parts) {
      return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)).toISOString();
    }
    return date.toISOString();
  }

  const trimmed = String(date).trim();
  if (!trimmed) return toSafeISOString(new Date());

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0)).toISOString();
  }

  // DD-MM-YYYY or DD/MM/YYYY (Pakistani format)
  const pkMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (pkMatch) {
    const [, d, m, y] = pkMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0)).toISOString();
  }

  // If already a full ISO timestamp with time (e.g., 2026-11-04T12:00:00.000Z), normalize its PKT date to 12:00:00 UTC
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return toSafeISOString(new Date());
  const parts = getPKTParts(d);
  if (parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)).toISOString();
  }
  return d.toISOString();
}

/**
 * Backend/Server-safe Date parser that extracts the exact Pakistani calendar date
 * and anchors at 12:00:00 UTC without allowing server clocks to shift the day.
 */
export function parseSafeDate(date: string | Date | undefined | null): Date {
  if (!date) {
    const todayParts = getPKTParts(new Date());
    if (todayParts) {
      return new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day, 12, 0, 0, 0));
    }
    return new Date();
  }
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return new Date();
    const parts = getPKTParts(date);
    if (parts) {
      return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
    }
    return date;
  }

  const trimmed = String(date).trim();
  if (!trimmed) return parseSafeDate(new Date());

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0));
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const pkMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (pkMatch) {
    const [, d, m, y] = pkMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0));
  }

  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return parseSafeDate(new Date());
  const parts = getPKTParts(d);
  if (parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
  }
  return d;
}

/**
 * Parses a date for Opening Balance / Opening Stock anchored at 00:00:01 UTC (05:00:01 AM PKT)
 * on that Pakistani calendar day so that opening records always sort BEFORE any same-day
 * transactions (which are anchored at 12:00:00 UTC) and stay within both UTC and PKT day boundaries.
 */
export function parseSafeOpeningDate(date?: string | Date | null): Date {
  const parts = getPKTParts(date || new Date());
  if (!parts) return new Date();
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 1, 0));
}

export function toSafeOpeningISOString(date?: string | Date | null): string {
  return parseSafeOpeningDate(date).toISOString();
}

/**
 * Parses a single date boundary ("YYYY-MM-DD" or "DD-MM-YYYY") into exact Pakistan Standard Time
 * start-of-day (00:00:00.000 PKT = 19:00:00.000Z prev day) or end-of-day (23:59:59.999 PKT = 18:59:59.999Z).
 * Also covers 23:59:59.999 UTC for end-of-day so legacy UTC-stored dates on that calendar day are never missed.
 */
export function parsePKTDateBoundary(dateStr: string | Date | null | undefined, isEnd: boolean = false): Date | null {
  if (!dateStr) return null;
  const parts = getPKTParts(dateStr);
  if (!parts) return null;

  if (!isEnd) {
    // 00:00:00.000 PKT = 19:00:00.000Z of the previous day
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - PKT_OFFSET_MS);
  } else {
    // 23:59:59.999 PKT = 18:59:59.999Z of this day (exact end of day in Pakistan, preventing any leakage into next day)
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999) - PKT_OFFSET_MS);
  }
}


