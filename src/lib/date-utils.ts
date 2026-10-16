/**
 * Utility functions for handling dates safely across the application with Pakistani (DD-MM-YYYY) format support.
 */

// Formats a Date object to YYYY-MM-DD string for HTML inputs
export function toHTMLDateString(date: Date | string | undefined | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : safeDate(date);
  if (!d || isNaN(d.getTime())) return "";
  
  // Use local time for input dates to avoid timezone shifts
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

// Formats a Date object to DD-MM-YYYY string for Pakistani display
export function toPakistaniDateString(date: Date | string | undefined | null, separator: "-" | "/" = "-"): string {
  if (!date) return "";
  const d = date instanceof Date ? date : safeDate(date);
  if (!d || isNaN(d.getTime())) return "";
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  
  return `${day}${separator}${month}${separator}${year}`;
}

// Safely creates a Date object from a string (supports DD-MM-YYYY, YYYY-MM-DD, ISO) or returns a fallback date
export function safeDate(dateString: string | Date | undefined | null, fallback = new Date()): Date {
  if (!dateString) return fallback;
  if (dateString instanceof Date) return isNaN(dateString.getTime()) ? fallback : dateString;
  
  const trimmed = String(dateString).trim();
  
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
  
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  
  return `${day}-${month}-${year}`;
}

// Formats a date and time to Pakistani readable format: DD-MM-YYYY, hh:mm A (e.g., "14-09-2026, 12:00 PM")
export function formatReadableDateTime(date: string | Date | undefined | null): string {
  if (!date) return "-";
  const parsed = safeDate(date, new Date(0));
  if (parsed.getTime() === 0) return "-";
  
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();

  let hours = parsed.getHours();
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursFormatted = String(hours).padStart(2, "0");

  return `${day}-${month}-${year}, ${hoursFormatted}:${minutes} ${ampm}`;
}

// Returns today's date formatted for an HTML input (YYYY-MM-DD)
export function getTodayHTMLDate(): string {
  return toHTMLDateString(new Date());
}

// Returns a date N days ago formatted for an HTML input (YYYY-MM-DD)
export function getDaysAgoHTMLDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toHTMLDateString(date);
}
