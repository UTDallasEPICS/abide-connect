/**
 * How an event's date and time are shown, and which day an event belongs to.
 *
 * Events happen at a physical place in Central time, so that's the only zone
 * they can honestly be rendered in — neither host's local zone will do.
 * Production runs the server in UTC, so a 7pm event derived with
 * `Date#getDate()` badges as the *next* day; a browser, meanwhile, renders
 * whatever zone the person is standing in. That split is what made the home
 * page print two dates for the same event: the card badge in "Upcoming Events"
 * came from the API (server zone) while "Your Events" was formatted in the
 * card component (browser zone).
 *
 * This lives in `shared/` for the same reason `reportRange.ts` does: both
 * halves have to answer identically or the page contradicts itself.
 */
import { REPORT_TIME_ZONE, zonedParts, zonedTime } from './reportRange'

/** The org's timezone — the same one the reports are cut in. */
export const EVENT_TIME_ZONE = REPORT_TIME_ZONE

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let cached = formatterCache.get(key)
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', { timeZone, ...options })
    formatterCache.set(key, cached)
  }
  return cached
}

/** Prisma hands back `Date`; JSON over the wire hands back a string. */
function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** The two lines of the date badge on an event card. */
export interface EventDateBadge {
  /** Day of month, zero-padded: `08`, `31`. */
  day: string
  /** Abbreviated month: `Aug`. */
  month: string
}

export function eventDateBadge(value: Date | string | number, timeZone = EVENT_TIME_ZONE): EventDateBadge {
  const date = toDate(value)
  const parts = formatter(timeZone, { day: '2-digit', month: 'short' }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  return { day: get('day'), month: get('month') }
}

/** `Sun, August 31` — the date line on the list-style event card. */
export function formatEventDate(value: Date | string | number, timeZone = EVENT_TIME_ZONE): string {
  return formatter(timeZone, { weekday: 'short', month: 'long', day: 'numeric' }).format(toDate(value))
}

/** `7:00 PM`. */
export function formatEventTime(value: Date | string | number, timeZone = EVENT_TIME_ZONE): string {
  return formatter(timeZone, { hour: 'numeric', minute: '2-digit' }).format(toDate(value))
}

/** `Sun, August 31 • 7:00 PM`. */
export function formatEventDateTime(value: Date | string | number, timeZone = EVENT_TIME_ZONE): string {
  const date = toDate(value)
  return `${formatEventDate(date, timeZone)} • ${formatEventTime(date, timeZone)}`
}

/**
 * The instant a Central day starts, and the instant it ends (inclusive, as the
 * `lte` bounds these queries already use).
 */
export function zonedDayBounds(value: Date | string | number, timeZone = EVENT_TIME_ZONE): { start: Date, end: Date } {
  const p = zonedParts(toDate(value), timeZone)
  return {
    start: zonedTime(p.year, p.month, p.day, 0, timeZone),
    end: new Date(zonedTime(p.year, p.month, p.day + 1, 0, timeZone).getTime() - 1),
  }
}

/**
 * The same bounds for a day named as `YYYY-MM-DD` — a date the caller already
 * has as calendar fields, which must not be round-tripped through `new Date()`
 * first: `new Date('2025-08-31T00:00:00')` is parsed in the *host's* zone, and
 * with a `Z` it is Central the evening before.
 */
export function zonedDayBoundsForDate(isoDate: string, timeZone = EVENT_TIME_ZONE): { start: Date, end: Date } {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number]
  return {
    start: zonedTime(year, month, day, 0, timeZone),
    end: new Date(zonedTime(year, month, day + 1, 0, timeZone).getTime() - 1),
  }
}

/**
 * Sunday through Saturday, in Central, around the given instant.
 *
 * Sunday-start on purpose: this backs the "this week" list on the events page,
 * which reads as a calendar week. (`startOfZonedWeek` in `reportRange.ts` is
 * Monday-start because a volunteer's *schedule* week reads Mon-Sun — the two
 * are different questions, not a contradiction.)
 */
export function zonedWeekBounds(value: Date | string | number, timeZone = EVENT_TIME_ZONE): { start: Date, end: Date } {
  const p = zonedParts(toDate(value), timeZone)
  const start = zonedTime(p.year, p.month, p.day - p.weekday, 0, timeZone)
  const startParts = zonedParts(start, timeZone)
  const end = new Date(zonedTime(startParts.year, startParts.month, startParts.day + 7, 0, timeZone).getTime() - 1)

  return { start, end }
}
