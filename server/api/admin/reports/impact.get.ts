import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { getReportingSettings } from '#server/utils/appSettings'
import {
  FULL_TIME_HOURS_PER_YEAR,
  attributeProgram,
  parseReportQuery,
  programLabel,
  round,
  statusFilter,
  sum,
} from '#server/utils/reporting'
import {
  REPORT_TIME_ZONE,
  buildBuckets,
  formatRangeLabel,
  dayKey,
  addZonedDays,
  monthKey,
  previousYearRange,
} from '#shared/utils/reportRange'
import type { ImpactReport, ProgramHours, YearOverYearPoint } from '#shared/types/reports'

/**
 * The leadership and funder view behind `/admin/reports/impact`. Admin only for
 * now — there is no board or funder role yet, and the intent is that adding one
 * later changes this line and nothing else.
 *
 * Everything here is built to be pasted into a grant report, which sets two
 * rules the operational report doesn't have:
 *   - only APPROVED hours are ever counted, whatever `status` asks for. An
 *     in-kind dollar figure that includes unreviewed submissions is a number
 *     the org would have to walk back.
 *   - the hourly rate comes from the settings table and is reported alongside
 *     its source, so the reader can see which year's rate produced the total.
 */
export default defineEventHandler(async (event): Promise<ImpactReport> => {
  await requireRole(event, 'admin')

  const now = new Date()
  const { range, resolved } = parseReportQuery(event, now)
  const priorRange = previousYearRange(range)
  const settings = await getReportingSettings()

  // Approved only, regardless of the query param — see the note above.
  const approved = statusFilter('approved')

  const [currentLogs, priorLogs, volunteerAreas] = await Promise.all([
    prisma.volunteer_Hour_Log.findMany({
      where: { date: { gte: range.start, lt: range.end }, approvalStatus: approved },
      select: { volunteerId: true, date: true, hours: true, program: true },
    }),
    prisma.volunteer_Hour_Log.findMany({
      where: { date: { gte: priorRange.start, lt: priorRange.end }, approvalStatus: approved },
      select: { volunteerId: true, date: true, hours: true },
    }),
    prisma.volunteer_VolunteerArea.findMany({
      select: { volunteerId: true, volunteerArea: true },
    }),
  ])

  const areasByVolunteer = new Map<string, typeof volunteerAreas[number]['volunteerArea'][]>()
  for (const row of volunteerAreas) {
    areasByVolunteer.set(row.volunteerId, [
      ...(areasByVolunteer.get(row.volunteerId) ?? []),
      row.volunteerArea,
    ])
  }

  /* ----------------------------------------------------------------- totals */

  const hours = sum(currentLogs.map(log => log.hours))
  const priorHours = sum(priorLogs.map(log => log.hours))
  const volunteers = new Set(currentLogs.map(log => log.volunteerId)).size
  const priorVolunteers = new Set(priorLogs.map(log => log.volunteerId)).size

  const totals = {
    hours: round(hours),
    priorHours: round(priorHours),
    // Null rather than a percentage against zero — "+∞% vs last year" is not a
    // sentence anyone should put in front of a funder.
    hoursChangePct: priorHours > 0 ? round(((hours - priorHours) / priorHours) * 100) : null,
    inKindValue: round(hours * settings.volunteerHourlyRate, 2),
    priorInKindValue: round(priorHours * settings.volunteerHourlyRate, 2),
    volunteers,
    priorVolunteers,
    entries: currentLogs.length,
    averageHoursPerVolunteer: volunteers === 0 ? 0 : round(hours / volunteers),
    fullTimeEquivalent: round(hours / FULL_TIME_HOURS_PER_YEAR, 2),
  }

  /* ------------------------------------------------- month-over-month vs YoY */

  // Both years are bucketed by month and joined on position, not on month key:
  // a range that starts mid-month lines up with the same offset a year earlier,
  // which is what "same period last year" means on a fiscal-year report.
  const buckets = buildBuckets(range, 'month')
  const priorBuckets = buildBuckets(priorRange, 'month')

  const hoursByMonth = new Map<string, number>()
  for (const log of currentLogs) {
    const key = monthKey(log.date)
    hoursByMonth.set(key, (hoursByMonth.get(key) ?? 0) + log.hours)
  }
  const priorHoursByMonth = new Map<string, number>()
  for (const log of priorLogs) {
    const key = monthKey(log.date)
    priorHoursByMonth.set(key, (priorHoursByMonth.get(key) ?? 0) + log.hours)
  }

  const monthly: YearOverYearPoint[] = buckets.map((bucket, index) => ({
    key: bucket.key,
    label: bucket.label,
    hours: round(hoursByMonth.get(bucket.key) ?? 0),
    priorHours: round(priorHoursByMonth.get(priorBuckets[index]?.key ?? '') ?? 0),
  }))

  /* --------------------------------------------------------------- programs */

  const byProgram = new Map<string, {
    hours: number
    inferredHours: number
    volunteers: Set<string>
  }>()

  for (const log of currentLogs) {
    const { program, inferred } = attributeProgram(
      log.program,
      areasByVolunteer.get(log.volunteerId) ?? [],
    )
    const entry = byProgram.get(program)
      ?? { hours: 0, inferredHours: 0, volunteers: new Set<string>() }

    entry.hours += log.hours
    if (inferred) entry.inferredHours += log.hours
    entry.volunteers.add(log.volunteerId)
    byProgram.set(program, entry)
  }

  const programs: ProgramHours[] = [...byProgram.entries()]
    .map(([program, entry]) => ({
      program,
      label: programLabel(program),
      hours: round(entry.hours),
      value: round(entry.hours * settings.volunteerHourlyRate, 2),
      volunteers: entry.volunteers.size,
      inferredHours: round(entry.inferredHours),
    }))
    .sort((a, b) => b.hours - a.hours)

  return {
    range: { ...resolved, status: 'approved', timeZone: REPORT_TIME_ZONE },
    priorRange: {
      from: dayKey(priorRange.start),
      to: dayKey(addZonedDays(priorRange.end, -1)),
      label: formatRangeLabel(priorRange),
    },
    totals,
    monthly,
    programs,
    rate: {
      hourlyRate: settings.volunteerHourlyRate,
      source: settings.volunteerHourlyRateSource,
      usingDefaults: settings.usingDefaults,
      updatedAt: settings.updatedAt,
    },
  }
})
