/**
 * Utility functions for handling dates safely across the application.
 */

// Formats a Date object to YYYY-MM-DD string for HTML inputs
export function toHTMLDateString(date: Date): string {
  if (!date || isNaN(date.getTime())) return "";
  
  // Use local time for input dates to avoid timezone shifts
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

// Safely creates a Date object from a string or returns a fallback date
export function safeDate(dateString: string | Date | undefined | null, fallback = new Date()): Date {
  if (!dateString) return fallback;
  if (dateString instanceof Date) return isNaN(dateString.getTime()) ? fallback : dateString;
  
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? fallback : parsed;
}

// Formats a date to a readable format (e.g., "Jan 01, 2026")
export function formatReadableDate(date: string | Date | undefined | null): string {
  if (!date) return "-";
  const parsed = safeDate(date, new Date(0));
  if (parsed.getTime() === 0) return "-";
  
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(parsed);
}

// Formats a date and time to a readable format (e.g., "Jan 01, 2026, 12:00 PM")
export function formatReadableDateTime(date: string | Date | undefined | null): string {
  if (!date) return "-";
  const parsed = safeDate(date, new Date(0));
  if (parsed.getTime() === 0) return "-";
  
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
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

