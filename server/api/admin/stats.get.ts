import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { round } from '#server/utils/reporting'
import { resolvePreset } from '#shared/utils/reportRange'

/**
 * Headline counts for the admin dashboard KPI cards. Admin only.
 *
 * `pendingCertificates` mirrors the queue on /admin/training: a volunteer
 * counts as awaiting a certificate once the training they signed up for has
 * finished and their approval is still PENDING.
 *
 * `hoursYearToDate`/`hoursQuarterToDate` are approved hours only, so the tiles
 * agree with the totals on /admin/reports at its default filter. Their
 * boundaries come from `resolvePreset`, not from `new Date(year, 0, 1)` — the
 * server runs in UTC and the org is in Central, so a shift logged on the
 * evening of Dec 31 or of the last day of a quarter would otherwise be counted
 * in the wrong period.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const now = new Date()
  const yearToDate = resolvePreset('YTD', now)
  const quarterToDate = resolvePreset('QTD', now)

  const [
    totalUsers,
    activeVolunteers,
    pendingCertificates,
    pendingTimeLogs,
    ytdHours,
    qtdHours,
  ] = await Promise.all([
    // Everyone the org serves, minus staff — admins aren't part of the count.
    prisma.user.count({
      where: { roles: { none: { role: 'ADMIN', active: true } } },
    }),
    prisma.volunteer.count({
      where: { approvalStatus: 'APPROVED' },
    }),
    prisma.rSVP.count({
      where: {
        event: { isTraining: true, endTime: { lt: new Date() } },
        volunteer: { is: { approvalStatus: 'PENDING' } },
      },
    }),
    prisma.volunteer_Hour_Log.count({
      where: { approvalStatus: 'PENDING' },
    }),
    prisma.volunteer_Hour_Log.aggregate({
      where: {
        approvalStatus: 'APPROVED',
        date: { gte: yearToDate.start, lt: yearToDate.end },
      },
      _sum: { hours: true },
    }),
    prisma.volunteer_Hour_Log.aggregate({
      where: {
        approvalStatus: 'APPROVED',
        date: { gte: quarterToDate.start, lt: quarterToDate.end },
      },
      _sum: { hours: true },
    }),
  ])

  return {
    totalUsers,
    activeVolunteers,
    pendingCertificates,
    pendingTimeLogs,
    hoursYearToDate: round(ytdHours._sum?.hours ?? 0),
    hoursQuarterToDate: round(qtdHours._sum?.hours ?? 0),
  }
})
