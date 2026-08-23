import type { H3Event } from 'h3'
import type { ApprovalStatus, VolunteerArea } from '#server/utils/generated/prisma/enums'
import type { DateRange, Granularity, RangePresetId } from '#shared/utils/reportRange'
import type { HourStatusFilter, ResolvedRange } from '#shared/types/reports'
import {
  REPORT_TIME_ZONE,
  addZonedDays,
  autoGranularity,
  dayKey,
  formatRangeLabel,
  rangeDays,
  resolveCustomRange,
  resolvePreset,
} from '#shared/utils/reportRange'

/**
 * Query parsing and the statistics shared by the two report endpoints.
 *
 * Aggregation happens in JS over rows fetched for the range rather than in SQL.
 * That is a deliberate trade: every bucket boundary here is a Central-time
 * calendar boundary, and SQLite's date functions only know UTC, so a `GROUP BY
 * strftime('%Y-%m', date)` would file a Sunday-evening shift under the wrong
 * month twice a year and under the wrong weekday every week. The table is a
 * nonprofit's hour logs — thousands of rows, not millions — so the whole range
 * fits in memory comfortably.
 */

/** Roughly a full-time year, the conventional divisor for FTE on grant reports. */
export const FULL_TIME_HOURS_PER_YEAR = 2080

/** Attribution bucket for hours nobody assigned to a program. */
export const UNASSIGNED_PROGRAM = 'UNASSIGNED'

/**
 * Wording matches `volunteerAreaItems` in the application form, minus the
 * parenthetical — these appear as chart labels, where the aside doesn't fit.
 */
export const PROGRAM_LABELS: Record<string, string> = {
  CLINIC_SUPPORT: 'Clinic Support',
  MOBILE_CLINIC_OUTREACH: 'Mobile Clinic Outreach',
  EVENT_SUPPORT: 'Event Support',
  COMMUNITY_OUTREACH: 'Community Outreach',
  ADMINISTRATIVE_TASKS: 'Administrative Tasks',
  OTHER: 'Other',
  [UNASSIGNED_PROGRAM]: 'Unassigned',
}

export function programLabel(program: string): string {
  return PROGRAM_LABELS[program] ?? program
}

/**
 * Which program an hour log belongs to.
 *
 * `Volunteer_Hour_Log.program` is authoritative when set. It won't be on
 * anything logged before the field existed, so the fallback reads the
 * volunteer's own areas — but only when there is exactly one, since splitting a
 * shift across someone's three declared areas would invent numbers a grant
 * report can't defend. Everything else is `UNASSIGNED`, reported as its own
 * line rather than folded into a program.
 *
 * The caller gets told which happened: inferred hours are counted separately so
 * the report can say how much of the breakdown is a guess.
 */
export function attributeProgram(
  explicit: VolunteerArea | null,
  volunteerAreas: VolunteerArea[],
): { program: string, inferred: boolean } {
  if (explicit) return { program: explicit, inferred: false }
  if (volunteerAreas.length === 1) return { program: volunteerAreas[0]!, inferred: true }
  return { program: UNASSIGNED_PROGRAM, inferred: false }
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length
}

/** Even-length arrays average the middle pair. Empty input is 0, not NaN. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!
}

/** Hours and dollars are only ever shown to 1-2 places; keep totals honest. */
export function round(value: number, places = 1): number {
  const factor = 10 ** places
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

/** Share of the total contributed by the busiest tenth, 0-1. */
export function topDecileShare(perVolunteerHours: number[]): number {
  const total = sum(perVolunteerHours)
  if (total === 0 || perVolunteerHours.length === 0) return 0

  const sorted = [...perVolunteerHours].sort((a, b) => b - a)
  const take = Math.max(1, Math.ceil(sorted.length * 0.1))
  return sum(sorted.slice(0, take)) / total
}

/**
 * How many of the busiest volunteers it takes to reach half the hours. The
 * plain-language version of the long tail: "6 of 48 people did half the work."
 */
export function volunteersForHalfOfHours(perVolunteerHours: number[]): number {
  const total = sum(perVolunteerHours)
  if (total === 0) return 0

  const sorted = [...perVolunteerHours].sort((a, b) => b - a)
  let running = 0
  for (const [index, hours] of sorted.entries()) {
    running += hours
    if (running >= total / 2) return index + 1
  }
  return sorted.length
}

/**
 * Fixed bins rather than equal-width ones derived from the max. A single
 * 400-hour volunteer would otherwise stretch every bin to 40 hours wide and
 * collapse the whole distribution into the first bar; these boundaries also
 * mean two reports over different ranges can be compared side by side.
 */
export const HISTOGRAM_BINS: { from: number, to: number | null, label: string }[] = [
  { from: 0, to: 5, label: '0–5' },
  { from: 5, to: 10, label: '5–10' },
  { from: 10, to: 20, label: '10–20' },
  { from: 20, to: 40, label: '20–40' },
  { from: 40, to: 80, label: '40–80' },
  { from: 80, to: 160, label: '80–160' },
  { from: 160, to: null, label: '160+' },
]

export function binHours(perVolunteerHours: number[]) {
  return HISTOGRAM_BINS.map(bin => ({
    ...bin,
    volunteers: perVolunteerHours.filter(hours =>
      hours >= bin.from && (bin.to === null || hours < bin.to),
    ).length,
  }))
}

/**
 * Time-of-day bands for the coverage heatmap. Four bands, not 24 hourly
 * columns: shifts are half-days, and a 7×24 grid of mostly-empty cells hides
 * the gap it is supposed to expose. `toHour` is exclusive; NIGHT wraps midnight
 * and is handled by `bandForHour` rather than by the bounds.
 */
export const TIME_BANDS = [
  { id: 'MORNING', label: 'Morning', fromHour: 5, toHour: 12 },
  { id: 'AFTERNOON', label: 'Afternoon', fromHour: 12, toHour: 17 },
  { id: 'EVENING', label: 'Evening', fromHour: 17, toHour: 22 },
  { id: 'NIGHT', label: 'Night', fromHour: 22, toHour: 5 },
] as const

export function bandForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'MORNING'
  if (hour >= 12 && hour < 17) return 'AFTERNOON'
  if (hour >= 17 && hour < 22) return 'EVENING'
  return 'NIGHT'
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * The approval statuses a report counts, from the `status` query param.
 *
 * Default is APPROVED only, matching what the member list already calls a
 * volunteer's hours. `all` exists because a coordinator sitting on a backlog
 * needs to see the shape of the work that was actually done, not just the part
 * they've got around to approving — the page labels which one is on screen.
 */
export function statusFilter(status: HourStatusFilter): { in: ApprovalStatus[] } {
  // Always an `in` filter with a mutable array — Prisma's generated filter type
  // rejects a `readonly` tuple, and keeping one shape means callers can drop it
  // straight into a `where` without narrowing a union first.
  return status === 'all'
    ? { in: ['APPROVED', 'PENDING'] }
    : { in: ['APPROVED'] }
}

export interface ReportQuery {
  range: DateRange
  preset: RangePresetId
  granularity: Granularity
  status: HourStatusFilter
  resolved: ResolvedRange
}

const PRESET_IDS = new Set<string>([
  'MTD', 'QTD', 'YTD', 'LAST_30', 'LAST_90', 'LAST_12_MONTHS', 'PREVIOUS_YEAR', 'ALL_TIME', 'CUSTOM',
])

/**
 * Reads `?preset=&from=&to=&granularity=&status=` into a resolved range.
 *
 * Throws a 400 on a custom range that doesn't parse rather than falling back to
 * a default — a report silently covering a different period than the one in the
 * header is worse than an error, because it gets copied into a grant report.
 */
export function parseReportQuery(event: H3Event, now = new Date()): ReportQuery {
  const query = getQuery(event)

  const requestedPreset = String(query.preset ?? 'YTD').toUpperCase()
  const preset = (PRESET_IDS.has(requestedPreset) ? requestedPreset : 'YTD') as RangePresetId

  let range: DateRange
  if (preset === 'CUSTOM') {
    const custom = resolveCustomRange(
      query.from ? String(query.from) : undefined,
      query.to ? String(query.to) : undefined,
    )
    if (!custom) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A custom range needs `from` and `to` as YYYY-MM-DD, with `to` on or after `from`.',
      })
    }
    range = custom
  }
  else {
    range = resolvePreset(preset, now)
  }

  const requestedGranularity = String(query.granularity ?? 'auto')
  const granularity: Granularity = requestedGranularity === 'day'
    || requestedGranularity === 'week'
    || requestedGranularity === 'month'
    ? requestedGranularity
    : autoGranularity(range)

  const status: HourStatusFilter = String(query.status ?? 'approved') === 'all' ? 'all' : 'approved'

  return {
    range,
    preset,
    granularity,
    status,
    resolved: {
      preset,
      from: dayKey(range.start),
      // `range.end` is exclusive; report the last day actually covered.
      to: dayKey(addZonedDays(range.end, -1)),
      label: formatRangeLabel(range),
      days: rangeDays(range),
      granularity,
      timeZone: REPORT_TIME_ZONE,
      status,
    },
  }
}
