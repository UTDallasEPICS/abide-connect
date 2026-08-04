import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import { canViewEvent } from '#shared/utils/eventType'

export default defineEventHandler(async (event) => {
  try {
    const viewer = await getEventViewer(event)

    const allEvents = await prisma.event.findMany({
      include: {
        location: true,
        eventAssets: true,
        volunteerHours: true,
        participants: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    // Volunteer-only and training events are filtered out here rather than in
    // the pages, so they never reach a browser that shouldn't see them.
    const visibleEvents = allEvents.filter(e => canViewEvent(e, viewer))

    console.log(`Fetched ${visibleEvents.length} of ${allEvents.length} events`)
    return visibleEvents
  }
  catch (error) {
    console.error('Error fetching events:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch events',
    })
  }
})
