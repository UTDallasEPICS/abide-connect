import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Headline counts for the admin dashboard KPI cards. Admin only.
 *
 * `pendingCertificates` mirrors the queue on /admin/training: a volunteer
 * counts as awaiting a certificate once the training they signed up for has
 * finished and their approval is still PENDING.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const [totalUsers, activeVolunteers, pendingCertificates, pendingTimeLogs] = await Promise.all([
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
  ])

  return { totalUsers, activeVolunteers, pendingCertificates, pendingTimeLogs }
})
