/**
 * Every user-facing date and time string in the app, and the day boundaries
 * that decide which day something belongs to.
 *
 * All of it is worded in `ORG_TIME_ZONE`, on purpose and everywhere. The two
 * host clocks both lie: production runs the server in UTC, so a 7pm event
 * formatted with `Date#getDate()` lands on the next day, and a browser formats
 * in whatever zone the reader is standing in, so the same event reads
 * differently in Dallas and in London. That split is what put two different
 * dates for one event on the home page — the card badge came from the API and
 * the date line came from the component.
 *
 * This lives in `shared/` because both halves format the same rows: an endpoint
 * pre-computes a card badge, a component renders the line under it, and an
 * email says the same thing in longer words. One module means they can't drift.
 *
 * Adding a format? Put it here rather than inlining a `toLocaleDateString` at
 * the call site — an inline one picks up the host zone by default, which is the
 * bug this module exists to prevent.
 */
import { ORG_TIME_ZONE } from './timeZone'
import { zonedParts, zonedTime } from './reportRange'

/** Anything a date can arrive as: Prisma gives `Date`, JSON gives a string. */
export type DateLike = Date | string | number

const formatterCache = new Map<string, Intl.DateTimeFormat>()

/**
 * Formatters are expensive to build and these run per row over lists, so they
 * are cached by their options — the same trick `reportRange.ts` uses.
 */
function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`
  let cached = formatterCache.get(key)
  if (!cached) {
    cached = new Intl.DateTimeFormat('en-US', { timeZone, ...options })
    formatterCache.set(key, cached)
  }
  return cached
}

function toDate(value: DateLike): Date {
  return value instanceof Date ? value : new Date(value)
}

// --- Times -----------------------------------------------------------------

/** `7:00 PM`. */
export function formatEventTime(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  return formatter(timeZone, { hour: 'numeric', minute: '2-digit' }).format(toDate(value))
}

/** `10:00 AM - 11:00 AM` — a block on an event, or an event's own window. */
export function formatTimeRange(start: DateLike, end: DateLike, timeZone = ORG_TIME_ZONE): string {
  return `${formatEventTime(start, timeZone)} - ${formatEventTime(end, timeZone)}`
}

// --- Dates -----------------------------------------------------------------

/** `Sun, August 31` — the date line on a list-style event card. */
export function formatEventDate(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  return formatter(timeZone, { weekday: 'short', month: 'long', day: 'numeric' }).format(toDate(value))
}

/** `Sunday, August 31` — the heading on an event's own page. */
export function formatEventLongDate(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  return formatter(timeZone, { weekday: 'long', month: 'long', day: 'numeric' }).format(toDate(value))
}

/** `Aug 31, 2025` — a record's date in a table or a detail row. */
export function formatShortDate(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  return formatter(timeZone, { month: 'short', day: 'numeric', year: 'numeric' }).format(toDate(value))
}

/** `August 31, 2025` — the same thing where there's room to spell it out. */
export function formatLongDate(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  return formatter(timeZone, { month: 'long', day: 'numeric', year: 'numeric' }).format(toDate(value))
}

/** `Aug 31` — no year, for something recent enough not to need one. */
export function formatMonthDay(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  return formatter(timeZone, { month: 'short', day: 'numeric' }).format(toDate(value))
}

/** The two lines of the date badge on an event card. */
export interface EventDateBadge {
  /** Day of month, zero-padded: `08`, `31`. */
  day: string
  /** Abbreviated month: `Aug`. */
  month: string
}

export function eventDateBadge(value: DateLike, timeZone = ORG_TIME_ZONE): EventDateBadge {
  const parts = formatter(timeZone, { day: '2-digit', month: 'short' }).formatToParts(toDate(value))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  return { day: get('day'), month: get('month') }
}

// --- Dates with times ------------------------------------------------------

/** `Sun, August 31 • 7:00 PM` — the list-style event card. */
export function formatEventDateTime(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  const date = toDate(value)
  return `${formatEventDate(date, timeZone)} • ${formatEventTime(date, timeZone)}`
}

/** `Aug 31, 2025, 7:00 PM` — a timestamped record in a table. */
export function formatShortDateTime(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  const date = toDate(value)
  return `${formatShortDate(date, timeZone)}, ${formatEventTime(date, timeZone)}`
}

/**
 * `Sunday, August 31 • 7:00 PM - 9:00 PM` — the when-and-how-long line at the
 * top of an event page. Collapses to the start alone when there's no end.
 */
export function formatEventSchedule(start: DateLike, end?: DateLike | null, timeZone = ORG_TIME_ZONE): string {
  const startDate = toDate(start)
  const head = `${formatEventLongDate(startDate, timeZone)} • ${formatEventTime(startDate, timeZone)}`
  if (end === undefined || end === null) return head

  return `${head} - ${formatEventTime(toDate(end), timeZone)}`
}

/** `Tuesday, March 4 at 9:00 AM` — the headline date in an email or a push. */
export function formatEventLongDateTime(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  const date = toDate(value)
  return `${formatEventLongDate(date, timeZone)} at ${formatEventTime(date, timeZone)}`
}

/**
 * `Tuesday, March 4 at 9:00 AM – 12:00 PM`, collapsing to the start alone when
 * the end is missing or on another day — a multi-day range spelled out in one
 * line reads worse than just telling people when to turn up.
 *
 * The en dash is deliberate: this wording goes into emails, where it is set in
 * whatever serif the client picks and a hyphen reads as a typo.
 */
export function formatEventWhen(start: DateLike, end?: DateLike | null, timeZone = ORG_TIME_ZONE): string {
  const startDate = toDate(start)
  const startText = formatEventLongDateTime(startDate, timeZone)
  if (!end) return startText

  const endDate = toDate(end)
  if (!isSameZonedDay(startDate, endDate, timeZone)) return startText

  return `${startText} – ${formatEventTime(endDate, timeZone)}`
}

// --- Days and boundaries ---------------------------------------------------

/** `YYYY-MM-DD` as the calendar reads it here. */
export function zonedDateKey(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  const p = zonedParts(toDate(value), timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Whether two instants fall on the same calendar day here. */
export function isSameZonedDay(a: DateLike, b: DateLike, timeZone = ORG_TIME_ZONE): boolean {
  return zonedDateKey(a, timeZone) === zonedDateKey(b, timeZone)
}

/**
 * The instant a day starts and the instant it ends. `end` is inclusive — the
 * last millisecond of the day — matching the `lte` bounds these queries use.
 */
export interface DayBounds {
  start: Date
  end: Date
}

export function zonedDayBounds(value: DateLike, timeZone = ORG_TIME_ZONE): DayBounds {
  const p = zonedParts(toDate(value), timeZone)
  return {
    start: zonedTime(p.year, p.month, p.day, 0, timeZone),
    end: new Date(zonedTime(p.year, p.month, p.day + 1, 0, timeZone).getTime() - 1),
  }
}

/**
 * The same bounds for a day named as `YYYY-MM-DD` — a date that arrived as
 * calendar fields (a `<input type="date">` value, a query param) and must not
 * be round-tripped through `new Date()` first: `new Date('2025-08-31')` is
 * midnight *UTC*, which here is 7pm on the 30th.
 */
export function zonedDayBoundsForDate(isoDate: string, timeZone = ORG_TIME_ZONE): DayBounds {
  const { year, month, day } = splitDateInput(isoDate)
  return {
    start: zonedTime(year, month, day, 0, timeZone),
    end: new Date(zonedTime(year, month, day + 1, 0, timeZone).getTime() - 1),
  }
}

/**
 * What a date arriving from a form means as an instant.
 *
 * A bare `YYYY-MM-DD` — an `<input type="date">` value — is a calendar date,
 * and the day someone picks is a day *here*: "March 4" becomes midnight on
 * March 4 Central. `new Date('2026-03-04')` instead reads it as midnight UTC,
 * which is 6pm on March 3 here, so a log filed for the 1st of a month was
 * being counted in the previous month by every report that buckets in this
 * zone. Anything carrying a time or an offset is already an instant and is
 * passed through untouched; unparseable input gives an invalid `Date`, so
 * callers can keep checking `Number.isNaN(d.getTime())`.
 */
export function parseZonedDate(value: string, timeZone = ORG_TIME_ZONE): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '')
  if (!dateOnly) return new Date(value)

  return zonedTime(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), 0, timeZone)
}

function splitDateInput(isoDate: string): { year: number, month: number, day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate?.trim() ?? '')
  if (!match) return { year: Number.NaN, month: Number.NaN, day: Number.NaN }

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/**
 * Sunday through Saturday around the given instant.
 *
 * Sunday-start on purpose: this backs the "this week" list on the events page,
 * which reads as a calendar week. (`startOfZonedWeek` in `reportRange.ts` is
 * Monday-start because a volunteer's *schedule* week reads Mon-Sun — a
 * different question, not a contradiction.)
 */
export function zonedWeekBounds(value: DateLike, timeZone = ORG_TIME_ZONE): DayBounds {
  const p = zonedParts(toDate(value), timeZone)
  const start = zonedTime(p.year, p.month, p.day - p.weekday, 0, timeZone)
  const s = zonedParts(start, timeZone)

  return {
    start,
    end: new Date(zonedTime(s.year, s.month, s.day + 7, 0, timeZone).getTime() - 1),
  }
}

// --- Form fields -----------------------------------------------------------

/**
 * An instant as the `YYYY-MM-DDTHH:mm` string a `datetime-local` input wants.
 *
 * The wall clock shown is this org's, not the browser's: an admin in another
 * state editing a 9am event sees "09:00", the same thing every other surface
 * says about it, and saves it back unchanged. `fromDateTimeLocal` is the exact
 * inverse — the pair has to agree or editing an event silently moves it.
 */
export function toDateTimeLocal(value: DateLike, timeZone = ORG_TIME_ZONE): string {
  const parts = formatter(timeZone, {
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(toDate(value))
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** What the admin typed, read as this org's wall clock. */
export function fromDateTimeLocal(value: string, timeZone = ORG_TIME_ZONE): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value?.trim() ?? '')
  if (!match) return new Date(Number.NaN)

  const [, year, month, day, hour, minute] = match
  const atHour = zonedTime(Number(year), Number(month), Number(day), Number(hour), timeZone)

  return new Date(atHour.getTime() + Number(minute) * 60_000)
}
