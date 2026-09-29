import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import { canViewEvent } from '#shared/utils/eventType'

/**
 * The time blocks an admin drew on an event, with how full each one is.
 *
 * Feeds three screens:
 *  - the volunteer's block list, which needs spots remaining and whether the
 *    viewer already holds the block;
 *  - the admin editor, which needs each block's `id` to send back on save
 *    (the save diffs by id — a block that loses its id is treated as new, and
 *    the one it replaced is deleted along with its signups);
 *  - the admin's roster view, which needs names.
 *
 * Counts are visible to anyone who can see the event; names are staff-only,
 * matching `rsvp.get.ts`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      allowVolunteers: true,
      allowAttendees: true,
      isTraining: true,
    },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // Same 404 for a hidden event as for a missing one, so blocks can't be used
  // to confirm that a volunteer-only event exists.
  const viewer = await getEventViewer(event)
  if (!canViewEvent(foundEvent, viewer)) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  const volunteer = viewer.userId
    ? await prisma.volunteer.findUnique({
        where: { userId: viewer.userId },
        select: { id: true },
      })
    : null

  const slots = await prisma.event_Time_Slot.findMany({
    where: { eventId: id },
    // Overlapping blocks are expected, so ties on start are broken by end.
    orderBy: [{ startTime: 'asc' }, { endTime: 'asc' }],
    include: {
      signups: {
        // Cancelled and admin-removed rows are kept in the table, so every
        // count has to filter or they silently consume capacity forever.
        where: { status: 'CONFIRMED' },
        select: {
          volunteerId: true,
          volunteer: {
            select: { user: { select: { name: true, email: true } } },
          },
        },
      },
    },
  })

  return {
    slots: slots.map((slot) => {
      const signupCount = slot.signups.length

      return {
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        role: slot.role,
        note: slot.note,
        color: slot.color,
        signupCount,
        // Deliberately not clamped at zero: an admin is allowed to cut
        // capacity below the number of people already signed up, and the UI
        // needs to be able to say the block is over capacity rather than
        // quietly showing "0 spots left".
        spotsRemaining: slot.capacity - signupCount,
        isFull: signupCount >= slot.capacity,
        viewerSignedUp: !!volunteer && slot.signups.some(s => s.volunteerId === volunteer.id),
        // Rosters carry names and emails, so they're staff-only.
        ...(viewer.isAdmin
          ? {
              signups: slot.signups.map(s => ({
                volunteerId: s.volunteerId,
                // A Volunteer can exist without a linked User account.
                name: s.volunteer.user?.name ?? '',
                email: s.volunteer.user?.email ?? '',
              })),
            }
          : {}),
      }
    }),
  }
})
