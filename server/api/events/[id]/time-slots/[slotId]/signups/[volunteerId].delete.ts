import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Staff take a volunteer off a time block.
 *
 * Distinct from the volunteer cancelling themselves: the row is flipped to
 * REMOVED_BY_ADMIN and records who did it, when, and optionally why.
 *
 * The volunteer is NOT notified — automatic notification is deferred, so the
 * admin UI has to tell staff they need to contact the person themselves.
 */
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const slotId = getRouterParam(event, 'slotId')
  const volunteerId = getRouterParam(event, 'volunteerId')

  if (!eventId || !slotId || !volunteerId) {
    throw createError({ statusCode: 400, message: 'Missing event, time block, or volunteer ID' })
  }

  const session = await requireRole(event, 'admin')
  const body = await readBody(event).catch(() => ({}))

  const reason = typeof body?.reason === 'string' && body.reason.trim().length > 0
    ? body.reason.trim()
    : null

  const signup = await prisma.event_Time_Slot_Signup.findUnique({
    where: {
      timeSlotId_volunteerId: { timeSlotId: slotId, volunteerId },
    },
    include: {
      timeSlot: { select: { eventId: true } },
      volunteer: { select: { userId: true } },
    },
  })

  if (!signup || signup.timeSlot.eventId !== eventId || signup.status !== 'CONFIRMED') {
    throw createError({
      statusCode: 404,
      message: 'That volunteer is not signed up for this time block.',
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.event_Time_Slot_Signup.update({
      where: { id: signup.id },
      data: {
        status: 'REMOVED_BY_ADMIN',
        removedByUserId: session.user.id,
        removedAt: new Date(),
        removalReason: reason,
      },
    })

    const stillHeld = await tx.event_Time_Slot_Signup.count({
      where: {
        volunteerId,
        status: 'CONFIRMED',
        timeSlot: { eventId },
      },
    })

    // Their RSVP only comes off once they hold no blocks at all on the event.
    // A Volunteer can exist with no linked User account, in which case there
    // was never an RSVP row to remove.
    if (stillHeld === 0 && signup.volunteer.userId) {
      await tx.rSVP.deleteMany({
        where: { userId: signup.volunteer.userId, eventId, isVolunteer: true },
      })
    }
  })

  return {
    timeSlotId: slotId,
    volunteerId,
    status: 'REMOVED_BY_ADMIN',
    // Surfaced so the UI can't quietly imply the volunteer was told.
    volunteerNotified: false,
  }
})
