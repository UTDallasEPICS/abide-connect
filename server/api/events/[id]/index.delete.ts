import prisma from '#server/utils/prisma'
import { deleteCalendarEvent } from '#server/utils/googleCalendar'

export default defineEventHandler(async (event) => {
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
    const userId = event.context.session?.user?.id
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
