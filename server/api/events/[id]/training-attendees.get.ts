import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Lists the attendees of a training event who have a volunteer profile,
 * along with their current approval status, so staff can approve/deny them.
 * Admin only.
 *
 * Attendees without a volunteer profile are excluded — approval acts on the
 * `Volunteer` record, so there is nothing to approve for a plain guest. The
 * `volunteerId: { not: null }` filter and the `.filter(r => r.volunteer)` below
 * are the same condition applied twice: the second is what narrows the type for
 * the non-null assertions that follow.
 *
 * This is the per-event view of the queue that `admin/training-events.get.ts`
 * summarises across all trainings.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const rsvps = await prisma.rSVP.findMany({
    where: { eventId: id, volunteerId: { not: null } },
    include: {
      user: { select: { name: true, email: true } },
      volunteer: { select: { id: true, approvalStatus: true } },
    },
  })

  return rsvps
    .filter(r => r.volunteer)
    .map(r => ({
      userId: r.userId,
      volunteerId: r.volunteer!.id,
      name: r.user?.name ?? '',
      email: r.user?.email ?? '',
      approvalStatus: r.volunteer!.approvalStatus,
    }))
})
