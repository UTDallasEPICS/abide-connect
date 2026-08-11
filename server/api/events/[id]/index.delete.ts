import prisma from '#server/utils/prisma'
import { deleteCalendarEvent } from '#server/utils/googleCalendar'
import { requireRole } from '#server/utils/requireRole'

/**
 * Deletes an event and its dependent rows, and removes the shared Google
 * Calendar entry. Admin only, matching its `index.post.ts` and
 * `index.patch.ts` siblings.
 *
 * The `requireRole` call does double duty: besides gating the route, it is what
 * populates `event.context.session` (the global middleware is a no-op), and the
 * calendar cleanup below needs a user id to mint a Google token from. Without
 * it that `userId` is always undefined and the entry lingers on the shared
 * calendar after the event disappears from the app — so the session is taken
 * from `requireRole`'s return value rather than read back off the context.
 */
export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // Best-effort: remove the entry from the shared Google Calendar first, using
  // the requesting volunteer's OAuth session. A failure here never blocks the
  // database deletion below.
  if (foundEvent.calendarEventId) {
    const userId = session.user?.id
    if (userId) {
      await deleteCalendarEvent(userId, foundEvent.calendarEventId)
    }
  }

  try {
    // Remove dependent rows before the event itself. Only GuestRSVP cascades in
    // the schema, so the other relations are cleared explicitly in a transaction.
    await prisma.$transaction([
      prisma.event_Asset.deleteMany({ where: { eventId: id } }),
      prisma.rSVP.deleteMany({ where: { eventId: id } }),
      prisma.volunteer_Hour_Log.deleteMany({ where: { eventId: id } }),
      prisma.guestRSVP.deleteMany({ where: { eventId: id } }),
      prisma.event.delete({ where: { id } }),
    ])

    console.log('🗑️ Event deleted:', id)
    setResponseStatus(event, 204)
    return null
  }
  catch (error) {
    console.error('❌ Error deleting event:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to delete event',
    })
  }
})
