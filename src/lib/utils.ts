import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${day} ${month} ${timeString}`
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