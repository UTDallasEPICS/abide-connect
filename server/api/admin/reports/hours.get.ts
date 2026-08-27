import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { getReportingSettings } from '#server/utils/appSettings'
import {
  TIME_BANDS,
  bandForHour,
  binHours,
  daysBetween,
  mean,
  median,
  parseReportQuery,
  round,
  statusFilter,
  sum,
  topDecileShare,
  volunteersForHalfOfHours,
} from '#server/utils/reporting'
import {
  REPORT_TIME_ZONE,
  addZonedMonths,
  bucketKey,
  buildBuckets,
  monthKey,
  monthsBetweenKeys,
  previousYearRange,
  zonedParts,
} from '#shared/utils/reportRange'
import { slotDurationHours } from '#shared/utils/timeSlot'
import type {
  CoverageCell,
  CohortRow,
  HoursReport,
  LapseRiskEntry,
  NewVsReturningPoint,
  TimeSeriesPoint,
} from '#shared/types/reports'

/**
 * The operational volunteer-hours report behind `/admin/reports`. Admin only.
 *
 * One request returns every panel on the page. They share the same row set and
 * the same range, so splitting them into seven endpoints would mean seven scans
 * of the same table and a page that can show two panels disagreeing while the
 * slower ones are still in flight.
 *
 * Two things are deliberately *not* scoped to the selected range:
 *   - the approval backlog, which is a statement about the queue right now;
 *   - lifetime totals and last-activity dates in the lapse list, since someone
 *     who last volunteered before the range started is exactly who it's for.
 * Everything else covers the range and nothing but the range.
 */
export default defineEventHandler(async (event): Promise<HoursReport> => {
  await requireRole(event, 'admin')

  const now = new Date()
  const { range, granularity, status, resolved } = parseReportQuery(event, now)
  const counted = statusFilter(status)
  const settings = await getReportingSettings()

  const [
    logsInRange,
    lifetimeByVolunteer,
    recentByVolunteer,
    roster,
    pendingAggregate,
    decidedInRange,
    slotsInRange,
    unslottedEvents,
  ] = await Promise.all([
    prisma.volunteer_Hour_Log.findMany({
      where: { date: { gte: range.start, lt: range.end }, approvalStatus: counted },
      select: { volunteerId: true, date: true, hours: true, approvalStatus: true },
    }),

    // Lifetime first/last/total per volunteer — feeds both the lapse list and
    // the new-vs-returning split, which needs each volunteer's first-ever month
    // and so cannot be answered from the range alone.
    prisma.volunteer_Hour_Log.groupBy({
      by: ['volunteerId'],
      where: { approvalStatus: counted },
      _min: { date: true },
      _max: { date: true },
      _sum: { hours: true },
    }),

    prisma.volunteer_Hour_Log.groupBy({
      by: ['volunteerId'],
      where: {
        approvalStatus: counted,
        date: { gte: addZonedMonths(now, -12) },
      },
      _sum: { hours: true },
    }),

    prisma.volunteer.findMany({
      where: { isActive: true },
      select: {
        id: true,
        approvalStatus: true,
        volunteerAreas: { select: { volunteerArea: true } },
        user: { select: { name: true, email: true, createdAt: true } },
      },
    }),

    // Queue state as of now, not as of the range.
    prisma.volunteer_Hour_Log.aggregate({
      where: { approvalStatus: 'PENDING' },
      _count: { _all: true },
      _sum: { hours: true },
      _min: { createdAt: true },
    }),

    prisma.volunteer_Hour_Log.findMany({
      where: {
        approvalStatus: { in: ['APPROVED', 'REJECTED'] },
        updatedAt: { gte: range.start, lt: range.end },
      },
      select: { createdAt: true, approvedAt: true },
    }),

    prisma.event_Time_Slot.findMany({
      where: { startTime: { gte: range.start, lt: range.end } },
      select: {
        startTime: true,
        endTime: true,
        capacity: true,
        signups: { where: { status: 'CONFIRMED' }, select: { volunteerId: true } },
      },
    }),

    // Events with no blocks drawn on them still tell us when volunteers were
    // on site; they just can't say how many were asked for.
    prisma.event.findMany({
      where: { startTime: { gte: range.start, lt: range.end }, timeSlots: { none: {} } },
      select: {
        startTime: true,
        endTime: true,
        participants: { where: { isVolunteer: true }, select: { volunteerId: true } },
      },
    }),
  ])

  const rosterById = new Map(roster.map(volunteer => [volunteer.id, volunteer]))
  const displayName = (volunteerId: string) => {
    const volunteer = rosterById.get(volunteerId)
    return volunteer?.user?.name || volunteer?.user?.email || 'Unnamed volunteer'
  }

  /* ---------------------------------------------------------------- summary */

  const hoursByVolunteer = new Map<string, number>()
  for (const log of logsInRange) {
    hoursByVolunteer.set(log.volunteerId, (hoursByVolunteer.get(log.volunteerId) ?? 0) + log.hours)
  }
  const perVolunteerHours = [...hoursByVolunteer.values()]

  const hoursByStatus = (target: string) =>
    sum(logsInRange.filter(log => log.approvalStatus === target).map(log => log.hours))

  // Rejected hours are never in `logsInRange` (no filter includes them), so
  // they're counted separately rather than reported as zero.
  const rejectedHours = await prisma.volunteer_Hour_Log.aggregate({
    where: { date: { gte: range.start, lt: range.end }, approvalStatus: 'REJECTED' },
    _sum: { hours: true },
  })

  const priorYear = previousYearRange(range)
  const priorPeriod = await prisma.volunteer_Hour_Log.aggregate({
    where: { date: { gte: priorYear.start, lt: priorYear.end }, approvalStatus: counted },
    _sum: { hours: true },
  })

  const summary = {
    totalHours: round(sum(logsInRange.map(log => log.hours))),
    approvedHours: round(hoursByStatus('APPROVED')),
    pendingHours: round(hoursByStatus('PENDING')),
    rejectedHours: round(rejectedHours._sum?.hours ?? 0),
    activeVolunteers: hoursByVolunteer.size,
    rosterVolunteers: roster.filter(v => v.approvalStatus === 'APPROVED').length,
    meanHoursPerVolunteer: round(mean(perVolunteerHours)),
    medianHoursPerVolunteer: round(median(perVolunteerHours)),
    totalEntries: logsInRange.length,
    topDecileShare: round(topDecileShare(perVolunteerHours) * 100),
    priorPeriodHours: round(priorPeriod._sum?.hours ?? 0),
  }

  /* ------------------------------------------------------------ time series */

  const buckets = buildBuckets(range, granularity)
  const seriesByKey = new Map<string, { hours: number, volunteers: Set<string> }>()
  for (const bucket of buckets) {
    seriesByKey.set(bucket.key, { hours: 0, volunteers: new Set() })
  }
  for (const log of logsInRange) {
    const entry = seriesByKey.get(bucketKey(log.date, granularity))
    if (!entry) continue
    entry.hours += log.hours
    entry.volunteers.add(log.volunteerId)
  }

  const series: TimeSeriesPoint[] = buckets.map((bucket) => {
    const entry = seriesByKey.get(bucket.key)!
    return {
      key: bucket.key,
      label: bucket.label,
      start: bucket.start.toISOString(),
      hours: round(entry.hours),
      volunteers: entry.volunteers.size,
      hoursPerVolunteer: entry.volunteers.size === 0
        ? 0
        : round(entry.hours / entry.volunteers.size),
    }
  })

  /* ----------------------------------------------------------- distribution */

  const distribution = {
    bins: binHours(perVolunteerHours),
    mean: summary.meanHoursPerVolunteer,
    median: summary.medianHoursPerVolunteer,
    max: round(Math.max(0, ...perVolunteerHours)),
    volunteersForHalfOfHours: volunteersForHalfOfHours(perVolunteerHours),
    totalVolunteers: perVolunteerHours.length,
  }

  /* ------------------------------------------------------------- lapse risk */

  const recentHoursById = new Map(
    recentByVolunteer.map(row => [row.volunteerId, row._sum?.hours ?? 0]),
  )

  // "Previously active" is the filter that makes this list actionable: someone
  // who never logged an hour isn't lapsing, they're un-onboarded, and mixing
  // the two turns the outreach list into the whole roster.
  const lapseCandidates = lifetimeByVolunteer
    .filter((row) => {
      const lastDate = row._max?.date
      const volunteer = rosterById.get(row.volunteerId)
      if (!lastDate || !volunteer) return false
      if (volunteer.approvalStatus !== 'APPROVED') return false
      return daysBetween(lastDate, now) >= settings.lapseThresholdDays
    })
    .sort((a, b) => (a._max?.date?.getTime() ?? 0) - (b._max?.date?.getTime() ?? 0))
    .slice(0, 50)

  // One extra query, over the candidates only, so each row can name what the
  // person was last doing — an outreach call opens far better with it. An empty
  // candidate list makes this an `IN ()`, which matches nothing rather than
  // scanning the table, so it doesn't need guarding.
  const lastLogs = await prisma.volunteer_Hour_Log.findMany({
    where: {
      volunteerId: { in: lapseCandidates.map(row => row.volunteerId) },
      approvalStatus: counted,
    },
    orderBy: { date: 'desc' },
    select: {
      volunteerId: true,
      date: true,
      eventName: true,
      event: { select: { title: true } },
    },
  })

  const lastActivityById = new Map<string, string>()
  for (const log of lastLogs) {
    if (lastActivityById.has(log.volunteerId)) continue
    lastActivityById.set(log.volunteerId, log.event?.title ?? log.eventName ?? 'Logged hours')
  }

  const lapseRisk: LapseRiskEntry[] = lapseCandidates.map((row) => {
    const volunteer = rosterById.get(row.volunteerId)
    const lastDate = row._max!.date!
    return {
      volunteerId: row.volunteerId,
      name: displayName(row.volunteerId),
      email: volunteer?.user?.email ?? null,
      daysSinceLastHour: daysBetween(lastDate, now),
      lastHourDate: lastDate.toISOString(),
      lifetimeHours: round(row._sum?.hours ?? 0),
      recentHours: round(recentHoursById.get(row.volunteerId) ?? 0),
      lastActivity: lastActivityById.get(row.volunteerId) ?? 'Logged hours',
    }
  })

  /* ---------------------------------------------------------------- backlog */

  // Only decisions carrying an `approvedAt` stamp can be measured; rows decided
  // before that column existed are counted and excluded rather than estimated
  // from `updatedAt`, which also moves when a comment is edited.
  const latencies = decidedInRange
    .filter(log => log.approvedAt !== null)
    .map(log => (log.approvedAt!.getTime() - log.createdAt.getTime()) / 86_400_000)

  const oldestPending = pendingAggregate._min?.createdAt
  const backlog = {
    pendingCount: pendingAggregate._count?._all ?? 0,
    pendingHours: round(pendingAggregate._sum?.hours ?? 0),
    oldestPendingDays: oldestPending ? daysBetween(oldestPending, now) : null,
    oldestPendingDate: oldestPending?.toISOString() ?? null,
    medianDaysToDecision: latencies.length === 0 ? null : round(median(latencies)),
    decidedCount: decidedInRange.length,
    unmeasuredCount: decidedInRange.length - latencies.length,
  }

  /* --------------------------------------------------------------- coverage */

  const coverageByCell = new Map<string, { filled: number, needed: number }>()
  const cellKey = (weekday: number, band: string) => `${weekday}:${band}`
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (const band of TIME_BANDS) {
      coverageByCell.set(cellKey(weekday, band.id), { filled: 0, needed: 0 })
    }
  }

  /**
   * Credits a window to the day/band its *start* falls in, in Central time.
   * A shift is filed where a volunteer would say it was — a 9am–1pm shift is a
   * Tuesday morning, not half a morning and half an afternoon — and splitting
   * the hours across bands would spread the very gap the grid is read for.
   */
  const addCoverage = (start: Date, filledHours: number, neededHours: number) => {
    const parts = zonedParts(start)
    const cell = coverageByCell.get(cellKey(parts.weekday, bandForHour(parts.hour)))
    if (!cell) return
    cell.filled += filledHours
    cell.needed += neededHours
  }

  for (const slot of slotsInRange) {
    const duration = slotDurationHours(slot)
    addCoverage(slot.startTime, duration * slot.signups.length, duration * slot.capacity)
  }
  for (const unslotted of unslottedEvents) {
    const duration = (unslotted.endTime.getTime() - unslotted.startTime.getTime()) / 3_600_000
    const volunteers = unslotted.participants.filter(rsvp => rsvp.volunteerId !== null).length
    addCoverage(unslotted.startTime, duration * volunteers, 0)
  }

  const cells: CoverageCell[] = [...coverageByCell.entries()].map(([key, value]) => {
    const [weekday, band] = key.split(':') as [string, string]
    return {
      weekday: Number(weekday),
      band,
      filledHours: round(value.filled),
      neededHours: round(value.needed),
      fillRate: value.needed > 0 ? round(value.filled / value.needed, 3) : null,
    }
  })

  const gaps = cells
    .filter(cell => cell.fillRate !== null && cell.fillRate < 1)
    .sort((a, b) => a.fillRate! - b.fillRate!)
  const worstGap = gaps[0]
    ? {
        weekday: gaps[0].weekday,
        band: gaps[0].band,
        fillRate: gaps[0].fillRate!,
        shortfallHours: round(gaps[0].neededHours - gaps[0].filledHours),
      }
    : null

  const coverage = {
    cells,
    bands: TIME_BANDS.map(band => ({ ...band })),
    maxFilledHours: round(Math.max(0, ...cells.map(cell => cell.filledHours))),
    needsAreUnknown: slotsInRange.length === 0,
    worstGap,
  }

  /* ------------------------------------------------------ new vs. returning */

  // A volunteer is "new" in the month they first ever logged hours, and
  // "returning" in every month after — measured against their lifetime first
  // log, so somebody who started in 2023 never reads as new inside a 2026 range.
  const firstMonthById = new Map<string, string>()
  for (const row of lifetimeByVolunteer) {
    if (row._min?.date) firstMonthById.set(row.volunteerId, monthKey(row._min.date))
  }

  const monthBuckets = buildBuckets(range, 'month')
  const newVsReturningByKey = new Map<string, {
    newHours: number
    returningHours: number
    newVolunteers: Set<string>
    returningVolunteers: Set<string>
  }>()
  for (const bucket of monthBuckets) {
    newVsReturningByKey.set(bucket.key, {
      newHours: 0,
      returningHours: 0,
      newVolunteers: new Set(),
      returningVolunteers: new Set(),
    })
  }

  for (const log of logsInRange) {
    const key = monthKey(log.date)
    const entry = newVsReturningByKey.get(key)
    if (!entry) continue

    if (firstMonthById.get(log.volunteerId) === key) {
      entry.newHours += log.hours
      entry.newVolunteers.add(log.volunteerId)
    }
    else {
      entry.returningHours += log.hours
      entry.returningVolunteers.add(log.volunteerId)
    }
  }

  const newVsReturning: NewVsReturningPoint[] = monthBuckets.map((bucket) => {
    const entry = newVsReturningByKey.get(bucket.key)!
    return {
      key: bucket.key,
      label: bucket.label,
      newHours: round(entry.newHours),
      returningHours: round(entry.returningHours),
      newVolunteers: entry.newVolunteers.size,
      returningVolunteers: entry.returningVolunteers.size,
    }
  })

  /* -------------------------------------------------------------- retention */

  // Cohort = the month a volunteer signed up (their account's creation date;
  // volunteers seeded without an account fall back to their first logged hour).
  // Only cohorts whose signup month falls inside the range get a row, so the
  // filter means the same thing here as everywhere else on the page.
  const activityMonthsById = new Map<string, Set<string>>()
  for (const log of logsInRange) {
    const months = activityMonthsById.get(log.volunteerId) ?? new Set<string>()
    months.add(monthKey(log.date))
    activityMonthsById.set(log.volunteerId, months)
  }

  const firstLogById = new Map(
    lifetimeByVolunteer
      .filter(row => row._min?.date)
      .map(row => [row.volunteerId, row._min!.date!]),
  )

  const cohortMembers = new Map<string, string[]>()
  for (const volunteer of roster) {
    const signupDate = volunteer.user?.createdAt ?? firstLogById.get(volunteer.id)
    if (!signupDate) continue
    if (signupDate < range.start || signupDate >= range.end) continue

    const key = monthKey(signupDate)
    cohortMembers.set(key, [...(cohortMembers.get(key) ?? []), volunteer.id])
  }

  const currentMonth = monthKey(now)
  const monthKeys = monthBuckets.map(bucket => bucket.key)
  const maxColumns = Math.min(12, monthKeys.length)

  const rows: CohortRow[] = [...cohortMembers.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 24)
    .map(([cohort, members]) => {
      const bucket = monthBuckets.find(b => b.key === cohort)
      return {
        cohort,
        label: bucket?.label ?? cohort,
        size: members.length,
        values: Array.from({ length: maxColumns }, (_, offset) => {
          const targetMonth = monthKeys.find(key => monthsBetweenKeys(cohort, key) === offset)
          // No column for a month that hasn't happened yet, or that falls
          // outside the range — a 0% cell there would read as total churn.
          if (!targetMonth || monthsBetweenKeys(targetMonth, currentMonth) < 0) return null

          const active = members.filter(id => activityMonthsById.get(id)?.has(targetMonth)).length
          return round((active / members.length) * 100, 0)
        }),
      }
    })

  const retention = {
    rows,
    columns: Array.from({ length: maxColumns }, (_, index) => `M${index}`),
  }

  return {
    range: { ...resolved, timeZone: REPORT_TIME_ZONE },
    summary,
    series,
    distribution,
    lapseRisk,
    lapseThresholdDays: settings.lapseThresholdDays,
    coverage,
    backlog,
    newVsReturning,
    retention,
  }
})
