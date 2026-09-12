import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { getReportingSettings } from '#server/utils/appSettings'
import {
  attributeProgram,
  parseReportQuery,
  programLabel,
  round,
  statusFilter,
  sum,
} from '#server/utils/reporting'
import { dayKey, formatRangeLabel } from '#shared/utils/reportRange'

/**
 * Date-bounded CSV export of volunteer hours. Admin only.
 *
 * Exists because grant deadlines don't line up with the dashboard's presets —
 * the point of this route is that any `from`/`to` an admin types produces the
 * same numbers the page shows for that range, in a file they can attach.
 *
 * `?dataset=` picks the grain:
 *   `logs`       — one row per hour log (the audit trail a funder may ask for)
 *   `volunteers` — one row per volunteer, totalled
 *   `programs`   — one row per program, totalled
 *
 * Every dataset carries the hourly rate and in-kind value, since a spreadsheet
 * that arrives without them gets the rate applied by hand and inconsistently.
 */

type Dataset = 'logs' | 'volunteers' | 'programs'

/**
 * RFC 4180 quoting. Note the leading apostrophe on anything that could be read
 * as a formula: these files get opened in Excel, and a volunteer whose name or
 * comment starts with `=` or `+` would otherwise be evaluated as one.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csvRows(rows: (string | number | null | undefined)[][]): string {
  // CRLF and a BOM: Excel reads UTF-8 as the local codepage without one, which
  // mangles any non-ASCII name in the file.
  return `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const { range, resolved, status } = parseReportQuery(event)
  const settings = await getReportingSettings()
  const rate = settings.volunteerHourlyRate

  const requested = String(getQuery(event).dataset ?? 'logs')
  const dataset: Dataset = requested === 'volunteers' || requested === 'programs'
    ? requested
    : 'logs'

  const logs = await prisma.volunteer_Hour_Log.findMany({
    where: { date: { gte: range.start, lt: range.end }, approvalStatus: statusFilter(status) },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      hours: true,
      program: true,
      approvalStatus: true,
      eventName: true,
      comment: true,
      volunteerId: true,
      event: { select: { title: true } },
      volunteer: {
        select: {
          volunteerAreas: { select: { volunteerArea: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  })

  const name = (log: typeof logs[number]) =>
    log.volunteer.user?.name || log.volunteer.user?.email || 'Unnamed volunteer'

  // A header block above the table, so a file that gets forwarded on still says
  // what period it covers and which rate produced the dollar column.
  const preamble: (string | number)[][] = [
    ['Abide Connect — volunteer hours export'],
    ['Period', formatRangeLabel(range)],
    ['From', resolved.from],
    ['To', resolved.to],
    ['Hours counted', status === 'all' ? 'Approved and pending' : 'Approved only'],
    ['Volunteer hourly rate', rate],
    ['Rate source', settings.volunteerHourlyRateSource],
    ['Generated', new Date().toISOString()],
    [],
  ]

  let body: (string | number | null)[][]

  if (dataset === 'volunteers') {
    const byVolunteer = new Map<string, { name: string, email: string, hours: number, entries: number }>()
    for (const log of logs) {
      const entry = byVolunteer.get(log.volunteerId)
        ?? { name: name(log), email: log.volunteer.user?.email ?? '', hours: 0, entries: 0 }
      entry.hours += log.hours
      entry.entries += 1
      byVolunteer.set(log.volunteerId, entry)
    }

    body = [
      ['Volunteer', 'Email', 'Entries', 'Hours', 'In-kind value (USD)'],
      ...[...byVolunteer.values()]
        .sort((a, b) => b.hours - a.hours)
        .map(entry => [
          entry.name,
          entry.email,
          entry.entries,
          round(entry.hours),
          round(entry.hours * rate, 2),
        ]),
    ]
  }
  else if (dataset === 'programs') {
    const byProgram = new Map<string, { hours: number, inferred: number, volunteers: Set<string> }>()
    for (const log of logs) {
      const { program, inferred } = attributeProgram(
        log.program,
        log.volunteer.volunteerAreas.map(area => area.volunteerArea),
      )
      const entry = byProgram.get(program)
        ?? { hours: 0, inferred: 0, volunteers: new Set<string>() }
      entry.hours += log.hours
      if (inferred) entry.inferred += log.hours
      entry.volunteers.add(log.volunteerId)
      byProgram.set(program, entry)
    }

    body = [
      ['Program', 'Volunteers', 'Hours', 'In-kind value (USD)', 'Hours attributed by inference'],
      ...[...byProgram.entries()]
        .sort(([, a], [, b]) => b.hours - a.hours)
        .map(([program, entry]) => [
          programLabel(program),
          entry.volunteers.size,
          round(entry.hours),
          round(entry.hours * rate, 2),
          round(entry.inferred),
        ]),
    ]
  }
  else {
    body = [
      ['Date', 'Volunteer', 'Email', 'Event', 'Program', 'Hours', 'In-kind value (USD)', 'Status', 'Comment'],
      ...logs.map(log => [
        dayKey(log.date),
        name(log),
        log.volunteer.user?.email ?? '',
        log.event?.title ?? log.eventName ?? 'Manual submission',
        programLabel(attributeProgram(
          log.program,
          log.volunteer.volunteerAreas.map(area => area.volunteerArea),
        ).program),
        log.hours,
        round(log.hours * rate, 2),
        log.approvalStatus,
        log.comment ?? '',
      ]),
    ]
  }

  const totalHours = sum(logs.map(log => log.hours))
  const csv = csvRows([
    ...preamble,
    ...body,
    [],
    ['Total hours', round(totalHours)],
    ['Total in-kind value (USD)', round(totalHours * rate, 2)],
  ])

  const filename = `abide-volunteer-hours-${dataset}-${resolved.from}-to-${resolved.to}.csv`
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${filename}"`)
  // The file names a period; a cached copy served for a different one is worse
  // than a second round-trip.
  setHeader(event, 'cache-control', 'no-store')

  return csv
})
