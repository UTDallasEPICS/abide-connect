/**
 * Date ranges and time bucketing for the volunteer-hours reports.
 *
 * Lives in `shared/` because both halves need identical answers: the picker
 * shows "Year to date" and the API decides which rows that covers, and if the
 * two disagreed the header would name a period the numbers don't match.
 *
 * Everything here is timezone-explicit. Production runs the server in UTC while
 * the org is in Central, so "this month" and "which day of the week were these
 * hours worked" are both wrong by default — hours logged on the evening of the
 * 31st land in the next month, and a Sunday-evening shift reads as Monday.
 * Nothing in this file uses the host's local timezone.
 */

/** The org's timezone. The cron in `nuxt.config.ts` already assumes it. */
export const REPORT_TIME_ZONE = 'America/Chicago'

/** A half-open interval: `start` is included, `end` is not. */
export interface DateRange {
  start: Date
  /** Exclusive — always the start of the day *after* the last day covered. */
  end: Date
}

export type RangePresetId
  = | 'MTD'
    | 'QTD'
    | 'YTD'
    | 'LAST_30'
    | 'LAST_90'
    | 'LAST_12_MONTHS'
    | 'PREVIOUS_YEAR'
    | 'ALL_TIME'
    | 'CUSTOM'

export interface RangePreset {
  id: RangePresetId
  label: string
}

/**
 * Offered in this order: the two the ask named come first, then the rolling
 * windows, then the fixed prior year a grant report usually wants.
 */
export const RANGE_PRESETS: RangePreset[] = [
  { id: 'YTD', label: 'Year to date' },
  { id: 'QTD', label: 'Quarter to date' },
  { id: 'MTD', label: 'Month to date' },
  { id: 'LAST_30', label: 'Last 30 days' },
  { id: 'LAST_90', label: 'Last 90 days' },
  { id: 'LAST_12_MONTHS', label: 'Last 12 months' },
  { id: 'PREVIOUS_YEAR', label: 'Previous calendar year' },
  { id: 'ALL_TIME', label: 'All time' },
  { id: 'CUSTOM', label: 'Custom range' },
]

export type Granularity = 'day' | 'week' | 'month'

/** Calendar fields of an instant, as read in a given timezone. */
export interface ZonedParts {
  year: number
  /** 1-12, not the 0-11 `Date` uses. */
  month: number
  day: number
  hour: number
  /** 0 = Sunday, matching `Date.prototype.getDay`. */
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/**
 * Formatters are rebuilt on every call otherwise, and these run once per row
 * over every hour log in the range — enough to show up on a year of data.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    formatterCache.set(timeZone, formatter)
  }
  return formatter
}

/** Reads an instant's calendar fields as they appear in `timeZone`. */
export function zonedParts(date: Date, timeZone = REPORT_TIME_ZONE): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0'

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

/** How far ahead of UTC `timeZone` is at this instant, in milliseconds. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const parts = partsFormatter(timeZone).formatToParts(date)
  const minute = Number(parts.find(x => x.type === 'minute')?.value ?? 0)
  const second = Number(parts.find(x => x.type === 'second')?.value ?? 0)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, minute, second)
  return asIfUtc - date.getTime()
}

/**
 * The instant at which the wall clock in `timeZone` reads the given fields.
 *
 * Solved by guessing UTC and correcting by the offset, twice: the first offset
 * is measured at the wrong instant, which only matters within a few hours of a
 * DST switch, and the second pass settles it.
 *
 * The spring-forward hour doesn't exist locally, and asking for it (2am on the
 * changeover day) returns the instant *before* the jump — the same one 1am
 * resolves to. Every boundary this file produces is a midnight, so that case is
 * unreachable in practice; it is documented rather than special-cased because
 * collapsing onto a real instant of the same day still puts a report boundary
 * on the correct side of every day, week and month.
 */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  timeZone = REPORT_TIME_ZONE,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour)
  const firstPass = new Date(naive - zoneOffsetMs(new Date(naive), timeZone))
  return new Date(naive - zoneOffsetMs(firstPass, timeZone))
}

/** Midnight, in `timeZone`, on the day this instant falls on. */
export function startOfZonedDay(date: Date, timeZone = REPORT_TIME_ZONE): Date {
  const p = zonedParts(date, timeZone)
  return zonedTime(p.year, p.month, p.day, 0, timeZone)
}

export function addZonedDays(date: Date, days: number, timeZone = REPORT_TIME_ZONE): Date {
  const p = zonedParts(date, timeZone)
  return zonedTime(p.year, p.month, p.day + days, 0, timeZone)
}

export function startOfZonedMonth(date: Date, timeZone = REPORT_TIME_ZONE): Date {
  const p = zonedParts(date, timeZone)
  return zonedTime(p.year, p.month, 1, 0, timeZone)
}

export function addZonedMonths(date: Date, months: number, timeZone = REPORT_TIME_ZONE): Date {
  const p = zonedParts(date, timeZone)
  return zonedTime(p.year, p.month + months, 1, 0, timeZone)
}

/** Monday-start, because a volunteer week reads Mon-Sun on a schedule. */
export function startOfZonedWeek(date: Date, timeZone = REPORT_TIME_ZONE): Date {
  const p = zonedParts(date, timeZone)
  const daysSinceMonday = (p.weekday + 6) % 7
  return zonedTime(p.year, p.month, p.day - daysSinceMonday, 0, timeZone)
}

/** `YYYY-MM` in the report timezone. The cohort and monthly-series key. */
export function monthKey(date: Date, timeZone = REPORT_TIME_ZONE): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}`
}

/** `YYYY-MM-DD` in the report timezone — also what the date inputs exchange. */
export function dayKey(date: Date, timeZone = REPORT_TIME_ZONE): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Whole months between two `YYYY-MM` keys. Negative if `to` precedes `from`. */
export function monthsBetweenKeys(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number) as [number, number]
  const [ty, tm] = to.split('-').map(Number) as [number, number]
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * Resolves a preset against "now" (injectable so the API and a test can pin it).
 *
 * `ALL_TIME` still needs a concrete start, since every chart axis and bucket
 * loop is bounded — 2015 predates the org's first record by a wide margin and
 * costs nothing on a table this size.
 */
export function resolvePreset(
  preset: Exclude<RangePresetId, 'CUSTOM'>,
  now = new Date(),
  timeZone = REPORT_TIME_ZONE,
): DateRange {
  const p = zonedParts(now, timeZone)
  // Exclusive end: tomorrow's midnight, so today's hours are always included.
  const tomorrow = zonedTime(p.year, p.month, p.day + 1, 0, timeZone)

  switch (preset) {
    case 'MTD':
      return { start: zonedTime(p.year, p.month, 1, 0, timeZone), end: tomorrow }
    case 'QTD': {
      const quarterFirstMonth = Math.floor((p.month - 1) / 3) * 3 + 1
      return { start: zonedTime(p.year, quarterFirstMonth, 1, 0, timeZone), end: tomorrow }
    }
    case 'YTD':
      return { start: zonedTime(p.year, 1, 1, 0, timeZone), end: tomorrow }
    case 'LAST_30':
      return { start: zonedTime(p.year, p.month, p.day - 29, 0, timeZone), end: tomorrow }
    case 'LAST_90':
      return { start: zonedTime(p.year, p.month, p.day - 89, 0, timeZone), end: tomorrow }
    case 'LAST_12_MONTHS':
      return { start: zonedTime(p.year, p.month - 11, 1, 0, timeZone), end: tomorrow }
    case 'PREVIOUS_YEAR':
      return {
        start: zonedTime(p.year - 1, 1, 1, 0, timeZone),
        end: zonedTime(p.year, 1, 1, 0, timeZone),
      }
    case 'ALL_TIME':
      return { start: zonedTime(2015, 1, 1, 0, timeZone), end: tomorrow }
  }
}

/**
 * A custom range from two `YYYY-MM-DD` strings, both inclusive as the admin
 * typed them — `to` is pushed to the following midnight so the last day counts.
 * Returns null on anything unparseable or backwards, so the caller can 400
 * rather than silently report on a range nobody asked for.
 */
export function resolveCustomRange(
  from: string | undefined,
  to: string | undefined,
  timeZone = REPORT_TIME_ZONE,
): DateRange | null {
  const pattern = /^(\d{4})-(\d{2})-(\d{2})$/
  const fromMatch = from?.match(pattern)
  const toMatch = to?.match(pattern)
  if (!fromMatch || !toMatch) return null

  const start = zonedTime(+fromMatch[1]!, +fromMatch[2]!, +fromMatch[3]!, 0, timeZone)
  const end = zonedTime(+toMatch[1]!, +toMatch[2]!, +toMatch[3]! + 1, 0, timeZone)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end <= start) return null

  return { start, end }
}

/** Days in a 1-12 month, so a shifted date can be clamped to a real one. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * The same span shifted back a year, for the year-over-year comparison.
 *
 * The two ends are shifted differently, because they mean different things.
 *
 * `start` is a real included date, so it is clamped to a date that exists: 29
 * February has no counterpart in a non-leap year, and letting it normalise
 * forward to 1 March would shorten the comparison window by a day — or, over a
 * single leap day, push the start past the end and collapse it to nothing.
 *
 * `end` is exclusive — always the midnight after the last day covered — so
 * rolling it forward is already right. A range ending 28 February 2024 has an
 * end of the 29th, and the answer for 2023 is 1 March, not 28 February, which
 * would drop the last day of the prior period.
 */
export function previousYearRange(range: DateRange, timeZone = REPORT_TIME_ZONE): DateRange {
  const shift = (d: Date, clamp: boolean) => {
    const p = zonedParts(d, timeZone)
    const day = clamp ? Math.min(p.day, daysInMonth(p.year - 1, p.month)) : p.day
    return zonedTime(p.year - 1, p.month, day, p.hour, timeZone)
  }
  return { start: shift(range.start, true), end: shift(range.end, false) }
}

export function rangeDays(range: DateRange): number {
  return Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000)
}

/**
 * Buckets wide enough that the chart doesn't turn into a comb: a quarter reads
 * well by week, a year only by month.
 */
export function autoGranularity(range: DateRange): Granularity {
  const days = rangeDays(range)
  if (days <= 31) return 'day'
  if (days <= 183) return 'week'
  return 'month'
}

export interface Bucket {
  /** Stable identity for the bucket — also the map key while aggregating. */
  key: string
  start: Date
  /** Exclusive. */
  end: Date
  /** Axis label, already timezone-correct. */
  label: string
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function bucketLabel(start: Date, granularity: Granularity, timeZone: string): string {
  const p = zonedParts(start, timeZone)
  if (granularity === 'month') return `${MONTH_SHORT[p.month - 1]} ${String(p.year).slice(2)}`
  return `${MONTH_SHORT[p.month - 1]} ${p.day}`
}

/**
 * Every bucket the range covers, including empty ones — a month with no hours
 * has to appear as a zero, or the line silently closes the gap and the chart
 * claims activity that didn't happen.
 *
 * The first and last buckets are whole calendar periods that may reach outside
 * the range; callers align by `key`, and the aggregation only ever sees rows
 * from inside the range, so the edge buckets are partial rather than wrong.
 */
export function buildBuckets(
  range: DateRange,
  granularity: Granularity,
  timeZone = REPORT_TIME_ZONE,
): Bucket[] {
  const step = {
    day: (d: Date) => addZonedDays(d, 1, timeZone),
    week: (d: Date) => addZonedDays(d, 7, timeZone),
    month: (d: Date) => addZonedMonths(d, 1, timeZone),
  }[granularity]

  const first = {
    day: startOfZonedDay,
    week: startOfZonedWeek,
    month: startOfZonedMonth,
  }[granularity](range.start, timeZone)

  const buckets: Bucket[] = []
  for (let cursor = first; cursor < range.end; cursor = step(cursor)) {
    const end = step(cursor)
    buckets.push({
      key: bucketKey(cursor, granularity, timeZone),
      start: cursor,
      end,
      label: bucketLabel(cursor, granularity, timeZone),
    })
    // Guard against a pathological range producing an unbounded axis.
    if (buckets.length > 800) break
  }
  return buckets
}

/** Which bucket an instant belongs to, as the key `buildBuckets` assigned. */
export function bucketKey(
  date: Date,
  granularity: Granularity,
  timeZone = REPORT_TIME_ZONE,
): string {
  if (granularity === 'month') return monthKey(date, timeZone)
  if (granularity === 'week') return dayKey(startOfZonedWeek(date, timeZone), timeZone)
  return dayKey(date, timeZone)
}

/** e.g. "Jan 1 – Aug 13, 2026". Used in report headers and export filenames. */
export function formatRangeLabel(range: DateRange, timeZone = REPORT_TIME_ZONE): string {
  const startParts = zonedParts(range.start, timeZone)
  // `end` is exclusive, so the last day covered is the one before it.
  const lastDay = zonedParts(addZonedDays(range.end, -1, timeZone), timeZone)

  const left = `${MONTH_SHORT[startParts.month - 1]} ${startParts.day}`
  const right = `${MONTH_SHORT[lastDay.month - 1]} ${lastDay.day}, ${lastDay.year}`

  return startParts.year === lastDay.year
    ? `${left} – ${right}`
    : `${left}, ${startParts.year} – ${right}`
}
