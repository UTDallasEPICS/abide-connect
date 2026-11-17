/**
 * Turns a Monday.com events-board CSV export into the rows `Event` stores.
 *
 * The sibling of `volunteerImport.ts`, and pure for the same reason: text in, a
 * plan out, nothing touching the database, so `/api/admin/ingest/events` runs
 * the same code for the preview and for the commit.
 *
 * A board export differs from a form export in ways that drive this file:
 *
 *   - The header is not necessarily the first line. Monday puts the board name
 *     above it, a group name above each group, and repeats the header row per
 *     group. `findHeaderRow` locates the real one and the planner skips the
 *     rest instead of reporting them as broken events.
 *   - Columns are whatever the board's owner called them, so each field is
 *     matched on a short list of likely names rather than one keyword.
 *   - When an event happens can arrive as a date column, a date column with a
 *     time in it, separate time columns, or a "timeline" range. All of them are
 *     read as this org's wall clock, never the host's — production runs in UTC
 *     and a 6pm event parsed there would land at noon.
 *
 * Nothing here decides the audience or the address for a row that has none;
 * the endpoint applies the defaults the admin picked on the import page.
 */
import { ORG_TIME_ZONE } from '#shared/utils/timeZone'
import { zonedTime } from '#shared/utils/reportRange'
import type { EventType } from '#shared/utils/eventType'

// --- Column resolution -----------------------------------------------------

/** Lower-cased, whitespace-collapsed, for matching a header by name. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim()
}

interface ColumnMatcher {
  /** Whole-header matches, tried first and in order. */
  exact?: string[]
  /** Substring matches, tried when no exact name hit. */
  includes?: string[]
  /** A header containing any of these is never a substring match. */
  excludes?: string[]
}

/**
 * The logical fields and the header names that supply them.
 *
 * Order matters: a header is claimed by the first field that matches it, so
 * the narrow fields come before the broad ones — "Short Description" has to be
 * taken by `shortDesc` before `description` sees it, and "End Date" by
 * `endDate` before `date` does.
 */
const COLUMN_MATCHERS = {
  title: { exact: ['name', 'title', 'event', 'event name', 'event title', 'item', 'item name'] },
  timeline: { includes: ['timeline'] },
  endDate: { exact: ['end', 'end date'], includes: ['end date'] },
  endTime: { exact: ['end time'], includes: ['end time'] },
  startTime: { exact: ['time', 'start time', 'hour'], includes: ['start time'] },
  date: {
    exact: ['date', 'event date', 'start date', 'start', 'when'],
    includes: ['date'],
    // Monday adds these to most boards; neither says when the event is.
    excludes: ['creat', 'updat', 'modif'],
  },
  location: { includes: ['location', 'address', 'venue', 'where'] },
  shortDesc: { includes: ['short desc', 'summary', 'tagline', 'blurb'] },
  description: { includes: ['description', 'details', 'notes'] },
  eventType: { exact: ['type'], includes: ['event type', 'audience', 'category', 'type'] },
} as const satisfies Record<string, ColumnMatcher>

export type EventColumnKey = keyof typeof COLUMN_MATCHERS

/** Logical field → index of the column that supplies it. */
export type EventColumnMap = Partial<Record<EventColumnKey, number>>

export function resolveEventColumns(headers: string[]): EventColumnMap {
  const normalized = headers.map(normalizeHeader)
  const claimed = new Set<number>()
  const map: EventColumnMap = {}

  for (const [field, matcher] of Object.entries(COLUMN_MATCHERS) as [EventColumnKey, ColumnMatcher][]) {
    let index = -1

    for (const name of matcher.exact ?? []) {
      index = normalized.findIndex((h, i) => !claimed.has(i) && h === name)
      if (index !== -1) break
    }

    if (index === -1) {
      index = normalized.findIndex((h, i) =>
        !claimed.has(i)
        && h !== ''
        && (matcher.includes ?? []).some(k => h.includes(k))
        && !(matcher.excludes ?? []).some(k => h.includes(k)),
      )
    }

    if (index !== -1) {
      map[field] = index
      claimed.add(index)
    }
  }

  return map
}

/**
 * The index of the real header row, or -1 when the file has none.
 *
 * It is the first row that names both a title column and something to date an
 * event by. Requiring both is what steps over the board-name line and the
 * group headings above it, each of which is a single cell.
 */
export function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((row) => {
    const columns = resolveEventColumns(row)
    return columns.title !== undefined && (columns.date !== undefined || columns.timeline !== undefined)
  })
}

// --- Dates and times -------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export interface ClockTime {
  hour: number
  minute: number
}

export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface DateWithOptionalTime extends CalendarDate {
  time: ClockTime | null
}

/** Rejects February 30th and the like, which `Date.UTC` would roll forward. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
}

/**
 * `9`, `9am`, `9:30 AM`, `14:30`, `09:00:00`.
 *
 * A bare hour with no meridiem is read on the 24-hour clock, so `9` is the
 * morning and `14` is 2pm; anything out of range is not a time.
 */
export function parseClockTime(value: string): ClockTime | null {
  const match = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AaPp])?\.?[Mm]?\.?$/.exec(value.trim())
  if (!match) return null

  const [, hourText, minuteText, meridiem] = match
  let hour = Number(hourText)
  const minute = Number(minuteText ?? 0)
  if (minute > 59) return null

  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    hour = hour % 12
    if (meridiem.toLowerCase() === 'p') hour += 12
  }
  else if (hour > 23) {
    return null
  }

  return { hour, minute }
}

/**
 * A Monday.com date cell, with the time if it carries one.
 *
 * Accepts the three shapes a board export produces depending on the column
 * type and the account's locale: `2026-03-14`, `Mar 14, 2026` and `3/14/2026`,
 * each optionally followed by a time. Slashed dates are read month-first, as
 * the org writes them.
 */
export function parseMondayDate(value: string): DateWithOptionalTime | null {
  const text = value.trim()
  if (!text) return null

  let year: number
  let month: number
  let day: number
  let rest: string

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/.exec(text)
  const named = /^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(.*)$/.exec(text)
  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/.exec(text)

  if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
    rest = iso[4]!
  }
  else if (named) {
    month = MONTHS.indexOf(named[1]!.slice(0, 3).toLowerCase()) + 1
    day = Number(named[2])
    year = Number(named[3])
    rest = named[4]!
  }
  else if (slashed) {
    month = Number(slashed[1])
    day = Number(slashed[2])
    year = Number(slashed[3])
    rest = slashed[4]!
  }
  else {
    return null
  }

  if (!isRealDate(year, month, day)) return null

  // What follows the date is either nothing or a time, joined by a space, a
  // comma, a `T` or "at".
  const timeText = rest.replace(/^[\s,T]+/, '').replace(/^at\s+/i, '').trim()
  if (!timeText) return { year, month, day, time: null }

  const time = parseClockTime(timeText)
  if (!time) return null

  return { year, month, day, time }
}

/** Splits `a - b` (hyphen, en dash, em dash or "to") into its two halves. */
function splitRange(value: string): [string, string] | null {
  const parts = value.split(/\s+(?:-|–|—|to)\s+/i)
  if (parts.length !== 2) return null
  return [parts[0]!.trim(), parts[1]!.trim()]
}

/** The instant the org's wall clock reads this date and time. */
function toInstant(date: CalendarDate, time: ClockTime): Date {
  const hour = zonedTime(date.year, date.month, date.day, time.hour, ORG_TIME_ZONE)
  return new Date(hour.getTime() + time.minute * 60_000)
}

// --- Audience --------------------------------------------------------------

/**
 * A board's free-text type/audience label → the event type it most plainly
 * means, or null when it says nothing recognisable and the admin's default
 * should apply.
 *
 * Deliberately conservative: guessing "public" for a label nobody anticipated
 * would publish an internal event to everyone, so an unknown label falls back
 * to the default the admin chose and is flagged for review instead.
 */
export function mapEventType(raw: string): EventType | null {
  const value = raw.toLowerCase()
  if (!value.trim()) return null

  if (value.includes('training') || value.includes('orientation')) return 'TRAINING'

  const volunteers = value.includes('volunteer')
  const attendees = /attendee|public|community|everyone|open|client/.test(value)

  if (volunteers && attendees) return 'VOLUNTEERS_AND_ATTENDEES'
  if (volunteers) return 'VOLUNTEERS'
  if (attendees) return 'ATTENDEES'
  return null
}

// --- The plan --------------------------------------------------------------

/** Used when a row has a date but no time anywhere. */
const DEFAULT_START: ClockTime = { hour: 9, minute: 0 }
const DEFAULT_END: ClockTime = { hour: 17, minute: 0 }
const DEFAULT_DURATION_MS = 60 * 60 * 1000

export interface PlannedEvent {
  /** 1-based line in the file, for pointing the admin at the source row. */
  rowNumber: number
  title: string
  shortDesc: string | null
  description: string | null
  startTime: Date
  endTime: Date
  /** Null when the row names no place; the endpoint applies the default. */
  location: string | null
  /** Null when the row names no recognisable audience. */
  eventType: EventType | null
  eventTypeRaw: string | null
  warnings: string[]
}

export interface RejectedEventRow {
  rowNumber: number
  title: string
  errors: string[]
}

export interface EventImportPlan {
  /** Rows that looked like events — headings and repeated headers excluded. */
  totalRows: number
  /** Optional columns this file doesn't have, by the name an admin would use. */
  missingColumns: string[]
  events: PlannedEvent[]
  rejected: RejectedEventRow[]
}

const COLUMN_LABELS: Partial<Record<EventColumnKey, string>> = {
  location: 'Location',
  description: 'Description',
  eventType: 'Type',
}

/**
 * The identity of an imported event: its title and the instant it starts.
 *
 * A board export carries no stable id unless someone adds the Item ID column,
 * so this is what makes re-running a file a no-op. Two different events with
 * the same name at the same minute are the same event for this purpose.
 */
export function eventImportKey(title: string, startTime: Date): string {
  return `${title.trim().toLowerCase()}|${startTime.toISOString()}`
}

/** When the row happens, or the reasons it can't be worked out. */
function resolveSchedule(
  read: (field: EventColumnKey) => string,
): { startTime: Date, endTime: Date, warnings: string[] } | { errors: string[] } {
  const warnings: string[] = []

  let startText = read('date')
  let endText = read('endDate')

  // A timeline column is a range in one cell and stands in for both dates.
  const timeline = read('timeline')
  if (!startText && timeline) {
    const range = splitRange(timeline)
    startText = range ? range[0] : timeline
    if (range && !endText) endText = range[1]
  }

  if (!startText) return { errors: ['No date.'] }

  const startDate = parseMondayDate(startText)
  if (!startDate) return { errors: [`Could not read "${startText}" as a date.`] }

  let endDate: DateWithOptionalTime | null = null
  if (endText) {
    endDate = parseMondayDate(endText)
    if (!endDate) return { errors: [`Could not read "${endText}" as an end date.`] }
  }

  // Times: the date cells win, then the time columns. A time column may itself
  // hold a range ("9:00 AM - 1:00 PM"), which supplies both ends.
  let startClock = startDate.time
  let endClock = endDate?.time ?? null

  const startTimeText = read('startTime')
  if (startTimeText) {
    const range = splitRange(startTimeText)
    const first = parseClockTime(range ? range[0] : startTimeText)
    if (!first) return { errors: [`Could not read "${startTimeText}" as a time.`] }
    startClock ??= first

    if (range) {
      const second = parseClockTime(range[1])
      if (!second) return { errors: [`Could not read "${startTimeText}" as a time.`] }
      endClock ??= second
    }
  }

  const endTimeText = read('endTime')
  if (endTimeText) {
    const parsed = parseClockTime(endTimeText)
    if (!parsed) return { errors: [`Could not read "${endTimeText}" as an end time.`] }
    endClock ??= parsed
  }

  const endDay: CalendarDate = endDate ?? startDate
  let startTime: Date
  let endTime: Date

  if (!startClock && !endClock) {
    startTime = toInstant(startDate, DEFAULT_START)
    endTime = toInstant(endDay, DEFAULT_END)
    warnings.push('No time on this row — assumed 9:00 AM to 5:00 PM.')
  }
  else if (startClock && !endClock && !endDate) {
    startTime = toInstant(startDate, startClock)
    endTime = new Date(startTime.getTime() + DEFAULT_DURATION_MS)
    warnings.push('No end time — assumed one hour.')
  }
  else {
    startTime = toInstant(startDate, startClock ?? DEFAULT_START)
    endTime = toInstant(endDay, endClock ?? DEFAULT_END)
    if (!startClock) warnings.push('No start time — assumed 9:00 AM.')
    if (!endClock) warnings.push('No end time — assumed 5:00 PM.')
  }

  if (endTime.getTime() <= startTime.getTime()) {
    return { errors: ['The event ends before it starts.'] }
  }

  return { startTime, endTime, warnings }
}

/**
 * Plans an import from the raw rows of a board export (see `parseCsvRows`).
 *
 * Returns `null` when no header row can be found, which is the one case where
 * there is nothing to preview at all.
 */
export function planEventImport(rows: string[][]): EventImportPlan | null {
  const headerIndex = findHeaderRow(rows)
  if (headerIndex === -1) return null

  const header = rows[headerIndex]!
  const columns = resolveEventColumns(header)
  const headerKey = header.map(normalizeHeader).join('|')

  const plan: EventImportPlan = {
    totalRows: 0,
    missingColumns: (Object.keys(COLUMN_LABELS) as EventColumnKey[])
      .filter(field => columns[field] === undefined)
      .map(field => COLUMN_LABELS[field]!),
    events: [],
    rejected: [],
  }

  const seen = new Map<string, number>()

  for (let index = headerIndex + 1; index < rows.length; index++) {
    const cells = rows[index]!
    const rowNumber = index + 1

    const filled = cells.filter(c => c.trim() !== '').length
    // Blank lines, group headings (one cell), and the header Monday repeats
    // above every group are structure, not events.
    if (filled <= 1) continue
    if (cells.map(normalizeHeader).join('|') === headerKey) continue

    const read = (field: EventColumnKey) => {
      const column = columns[field]
      return column === undefined ? '' : (cells[column] ?? '').trim()
    }

    plan.totalRows += 1

    const title = read('title')
    const errors: string[] = []
    if (!title) errors.push('No event name.')

    const schedule = resolveSchedule(read)
    if ('errors' in schedule) errors.push(...schedule.errors)

    if (errors.length > 0 || 'errors' in schedule) {
      plan.rejected.push({ rowNumber, title, errors })
      continue
    }

    const key = eventImportKey(title, schedule.startTime)
    const firstSeenAt = seen.get(key)
    if (firstSeenAt !== undefined) {
      plan.rejected.push({ rowNumber, title, errors: [`Duplicate of row ${firstSeenAt}.`] })
      continue
    }
    seen.set(key, rowNumber)

    const warnings = [...schedule.warnings]

    const eventTypeRaw = read('eventType') || null
    const eventType = eventTypeRaw ? mapEventType(eventTypeRaw) : null
    if (eventTypeRaw && !eventType) {
      warnings.push(`Type "${eventTypeRaw}" was not recognised — the default was used.`)
    }

    plan.events.push({
      rowNumber,
      title,
      shortDesc: read('shortDesc') || null,
      description: read('description') || null,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      location: read('location') || null,
      eventType,
      eventTypeRaw,
      warnings,
    })
  }

  return plan
}
