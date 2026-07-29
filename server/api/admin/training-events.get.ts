import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Every training event that has already finished, with the volunteers who
 * signed up and where their approval stands. Drives the admin approvals
 * queue: an event needs review while any attendee is still pending, and is
 * complete once everyone has been approved or denied. Admin only.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const trainings = await prisma.event.findMany({
    where: {
      isTraining: true,
      // Approvals only make sense once the training has actually happened.
      endTime: { lt: new Date() },
    },
    include: {
      location: true,
      participants: {
        where: { volunteerId: { not: null } },
        include: {
          user: { select: { name: true, email: true } },
          volunteer: { select: { id: true, approvalStatus: true } },
        },
      },
    },
    orderBy: { endTime: 'desc' },
  })

  return trainings.map((training) => {
    const attendees = training.participants
      .filter(p => p.volunteer)
      .map(p => ({
        userId: p.userId,
        volunteerId: p.volunteer!.id,
        name: p.user?.name ?? '',
        email: p.user?.email ?? '',
        approvalStatus: p.volunteer!.approvalStatus,
      }))

    return {
      id: training.id,
      title: training.title,
      startTime: training.startTime,
      endTime: training.endTime,
      address: training.location?.address ?? '',
      attendees,
      pendingCount: attendees.filter(a => a.approvalStatus === 'PENDING').length,
      approvedCount: attendees.filter(a => a.approvalStatus === 'APPROVED').length,
      rejectedCount: attendees.filter(a => a.approvalStatus === 'REJECTED').length,
    }
  })
})
