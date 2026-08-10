import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import { canViewEvent } from '#shared/utils/eventType'

/**
 * Every event the caller is allowed to see, soonest first. Includes past
 * events — callers filter by date themselves.
 *
 * Open to anonymous requests, but the response is audience-filtered: an
 * unauthenticated viewer sees only public events, approved volunteers also see
 * volunteer events, and so on (see `canViewEvent`). The filter runs in memory
 * after a full fetch rather than as a `where` clause, which keeps the rules in
 * one shared place at the cost of over-fetching — fine at this table's size,
 * worth revisiting if the event count grows.
 */
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
