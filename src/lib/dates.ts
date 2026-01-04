import { toZonedTime, format } from 'date-fns-tz';
import { addDays, startOfDay } from 'date-fns';

/**
 * Gets the next 7 days starting from "today" in the specified timezone.
 * Limited to 7 days because weather forecast accuracy degrades beyond that.
 * 
 * Critical for Cloudflare Workers: The server runs in UTC, but we need
 * to determine what "today" is in the user's local timezone.
 * 
 * Example: If it's Monday 11pm in Los Angeles (Tuesday 7am UTC),
 * this function correctly returns dates starting from Monday.
 */
export function getNextWeek(timezone: string): Date[] {
  // Get current UTC time
  const nowUtc = new Date();
  
  // Convert to the target timezone to find local "now"
  const localNow = toZonedTime(nowUtc, timezone);
  
  // Get the start of the local day (midnight in that timezone)
  const localStartOfDay = startOfDay(localNow);
  
  // Generate 7 days starting from local "today"
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    // addDays on the local date, then we have a Date object
    // representing that local calendar date
    dates.push(addDays(localStartOfDay, i));
  }
  
  return dates;
}

/**
 * Format a UTC Date to a localized time string in the target timezone.
 * Example: "7:45 PM"
 */
export function formatTimeInTimezone(date: Date | null, timezone: string): string {
  if (!date) return 'N/A';
  return format(toZonedTime(date, timezone), 'h:mm a', { timeZone: timezone });
}

/**
 * Format a date to a readable date string in the target timezone.
 * Example: "Mon, Dec 16"
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  return format(toZonedTime(date, timezone), 'EEE, MMM d', { timeZone: timezone });
}

/**
 * Gets the next N days starting from "today" in the specified timezone.
 * Used for moon calendar which doesn't need weather data.
 */
export function getNextDays(timezone: string, count: number): Date[] {
  const nowUtc = new Date();
  const localNow = toZonedTime(nowUtc, timezone);
  const localStartOfDay = startOfDay(localNow);
  
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(addDays(localStartOfDay, i));
  }
  
  return dates;
}
