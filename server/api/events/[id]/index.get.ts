import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import { canViewEvent } from '#shared/utils/eventType'

/**
 * A single event with its images and location.
 *
 * Open to anonymous callers, but audience-filtered — see the 404-not-403 note
 * below. Fetching happens before the visibility check because the event's own
 * audience flags are what the check reads.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
    include: {
      eventAssets: true,
      location: true,
    },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // Same 404 for a hidden event as for a missing one, so a volunteer-only
  // event can't be confirmed to exist by guessing its URL.
  const viewer = await getEventViewer(event)
  if (!canViewEvent(foundEvent, viewer)) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  return foundEvent
})
