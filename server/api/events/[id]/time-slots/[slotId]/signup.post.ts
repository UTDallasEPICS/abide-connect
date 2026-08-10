import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import { assertEventAcceptsTimeSlots } from '#server/utils/timeSlots'
import { intervalsOverlap } from '#shared/utils/timeSlot'

/**
 * A volunteer claims one time block.
 *
 * Every check here is server-side on purpose: the UI hides blocks a volunteer
 * can't take, but that's a convenience, not a control — anyone can POST at
 * this route directly.
 */
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  const slotId = getRouterParam(event, 'slotId')

  if (!eventId || !slotId) {
    throw createError({ statusCode: 400, message: 'Missing event or time block ID' })
  }

  // 1 + 2. Signed in, and holding an *active* VOLUNTEER role.
  const session = await requireRole(event, 'volunteer')

  // 3. Approved to volunteer. This is the training gate — `approvalStatus`,
  //    not the Volunteer_Certification rows, which are pre-existing
  //    professional credentials from the intake form.
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
    select: { id: true, approvalStatus: true, isActive: true },
  })

  if (!volunteer) {
    throw createError({
      statusCode: 403,
      message: 'You need a volunteer profile to sign up for a time block.',
    })
  }

  if (!volunteer.isActive) {
    throw createError({
      statusCode: 403,
      message: 'Your volunteer profile is inactive. Please contact staff.',
    })
  }

  if (volunteer.approvalStatus !== 'APPROVED') {
    throw createError({
      statusCode: 403,
      message: 'You must be an approved volunteer to sign up for a time block.',
    })
  }

  const slot = await prisma.event_Time_Slot.findUnique({
    where: { id: slotId },
    include: {
      event: {
        select: {
          id: true,
          allowVolunteers: true,
          allowAttendees: true,
          isTraining: true,
        },
      },
    },
  })

  // 5. The block has to belong to the event in the URL — otherwise a block id
  //    from an event the volunteer can't see would be claimable through one
  //    they can.
  if (!slot || slot.eventId !== eventId) {
    throw createError({ statusCode: 404, message: 'Time block not found' })
  }

  // 4. Blocks are volunteer shifts, so the event has to be one volunteers
  //    sign up for.
  assertEventAcceptsTimeSlots(slot.event)

  // 5 (cont). The *block's* end, not the event's: on an all-day event the
  //    afternoon shifts stay claimable after the morning ones have passed.
  if (slot.endTime.getTime() <= Date.now()) {
    throw createError({ statusCode: 400, message: 'That time block has already passed.' })
  }

  // 6-9 share a transaction. Without it two simultaneous requests both read
  // the same "spots left" and both insert, overfilling the block.
  await prisma.$transaction(async (tx) => {
    // 6. No overlapping block already held by this volunteer.
    //
    //    Scoped to this event: the reason for the rule is that the hour-log
    //    cron sums a volunteer's block durations per event, so only
    //    within-event overlap can double-count their hours. Double-booking
    //    across two simultaneous events is a scheduling concern the client
    //    hasn't asked us to police.
    const held = await tx.event_Time_Slot_Signup.findMany({
      where: {
        volunteerId: volunteer.id,
        status: 'CONFIRMED',
        timeSlot: { eventId },
        // Re-posting the same block isn't a conflict with itself.
        NOT: { timeSlotId: slotId },
      },
      select: {
        timeSlot: { select: { startTime: true, endTime: true } },
      },
    })

    const conflict = held.find(other =>
      intervalsOverlap(
        other.timeSlot.startTime,
        other.timeSlot.endTime,
        slot.startTime,
        slot.endTime,
      ),
    )

    if (conflict) {
      throw createError({
        statusCode: 409,
        message: 'You\'re already signed up for an overlapping time block.',
      })
    }

    // 7. Capacity. Only CONFIRMED rows count — cancelled ones stay in the
    //    table and would otherwise consume a spot forever. This volunteer is
    //    excluded so re-confirming a block they already hold is a no-op
    //    rather than a spurious "full".
    const taken = await tx.event_Time_Slot_Signup.count({
      where: {
        timeSlotId: slotId,
        status: 'CONFIRMED',
        NOT: { volunteerId: volunteer.id },
      },
    })

    if (taken >= slot.capacity) {
      throw createError({ statusCode: 409, message: 'This time block is already full.' })
    }

    // 8. Upsert, not create: a cancelled row still occupies the
    //    (timeSlotId, volunteerId) unique index, so signing up again has to
    //    revive it rather than insert alongside it.
    await tx.event_Time_Slot_Signup.upsert({
      where: {
        timeSlotId_volunteerId: { timeSlotId: slotId, volunteerId: volunteer.id },
      },
      update: {
        status: 'CONFIRMED',
        removedAt: null,
        removedByUserId: null,
        removalReason: null,
      },
      create: {
        timeSlotId: slotId,
        volunteerId: volunteer.id,
        status: 'CONFIRMED',
      },
    })

    // 9. Existing features answer "who's coming to this event" by reading
    //    RSVP — the stats panel, the sign-up list, the hour-log cron. Without
    //    this, a volunteer holding blocks is invisible to all of them.
    await tx.rSVP.upsert({
      where: { userId_eventId: { userId: session.user.id, eventId } },
      update: { isVolunteer: true, volunteerId: volunteer.id },
      create: {
        userId: session.user.id,
        eventId,
        isVolunteer: true,
        volunteerId: volunteer.id,
      },
    })
  })

  setResponseStatus(event, 201)
  return { timeSlotId: slotId, status: 'CONFIRMED' }
})
