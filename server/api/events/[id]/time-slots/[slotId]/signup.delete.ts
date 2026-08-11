import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * A volunteer drops a time block they hold.
 *
 * The row is kept and flipped to CANCELLED_BY_VOLUNTEER rather than deleted,
 * so staff can see that someone dropped out and so re-signing up revives the
 * same row (see the upsert in `signup.post.ts`).
 */
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const slotId = getRouterParam(event, 'slotId')

  if (!eventId || !slotId) {
    throw createError({ statusCode: 400, message: 'Missing event or time block ID' })
  }

  const session = await requireRole(event, 'volunteer')

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!volunteer) {
    throw createError({ statusCode: 403, message: 'You need a volunteer profile.' })
  }

  const signup = await prisma.event_Time_Slot_Signup.findUnique({
    where: {
      timeSlotId_volunteerId: { timeSlotId: slotId, volunteerId: volunteer.id },
    },
    include: { timeSlot: { select: { eventId: true } } },
  })

  // Already-cancelled rows read as "not signed up" rather than as a row to
  // cancel again.
  if (!signup || signup.timeSlot.eventId !== eventId || signup.status !== 'CONFIRMED') {
    throw createError({ statusCode: 404, message: 'You are not signed up for that time block.' })
  }

  // No check that the block is still in the future. If a volunteer no-showed,
  // cancelling afterwards is exactly right — otherwise the hour-log cron
  // credits them for a shift they didn't work and an admin approves it.
  await prisma.$transaction(async (tx) => {
    await tx.event_Time_Slot_Signup.update({
      where: { id: signup.id },
      data: { status: 'CANCELLED_BY_VOLUNTEER' },
    })

    const stillHeld = await tx.event_Time_Slot_Signup.count({
      where: {
        volunteerId: volunteer.id,
        status: 'CONFIRMED',
        timeSlot: { eventId },
      },
    })

    // Dropping one of several blocks leaves them attending the event; dropping
    // the last one means they're no longer coming.
    //
    // Known limitation: if they had registered as an attendee before claiming
    // a block, signing up overwrote that row to isVolunteer, and this removes
    // it. RSVP is one row per user per event, so holding both states isn't
    // possible without a schema change.
    if (stillHeld === 0) {
      await tx.rSVP.deleteMany({
        where: { userId: session.user.id, eventId, isVolunteer: true },
      })
    }
  })

  return { timeSlotId: slotId, status: 'CANCELLED_BY_VOLUNTEER' }
})
