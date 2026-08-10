import prisma from '#server/utils/prisma'
import { createCalendarEvent } from '#server/utils/googleCalendar'
import { requireRole } from '#server/utils/requireRole'
import { eventTypeFromFlags, eventTypeToFlags, isEventType } from '#shared/utils/eventType'
import {
  assertEventAcceptsTimeSlots,
  assertTimeSlotsValid,
  parseTimeSlotPayload,
} from '#server/utils/timeSlots'

/**
 * Resolves a free-text address to coordinates via OpenStreetMap's Nominatim.
 *
 * Only ever called on a cache miss — `Location` rows are keyed by address and
 * reused — because Nominatim's usage policy caps unauthenticated callers at
 * roughly one request per second and requires the identifying `User-Agent`
 * sent below.
 *
 * Returns null instead of throwing on any failure; the caller decides whether a
 * missing geocode is fatal.
 */
async function geocodeLocation(location: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
      {
        headers: {
          'User-Agent': 'Abide-Connect/1.0',
        },
      },
    )

    if (!response.ok) {
      console.warn(`Nominatim API error: ${response.status}`)
      return null
    }

    const results = await response.json()

    if (results.length === 0) {
      console.warn(`No geocoding results found for: ${location}`)
      return null
    }

    const topResult = results[0]
    console.log('latitude:', parseFloat(topResult.lat), 'longitude:', parseFloat(topResult.lon))
    return {
      latitude: parseFloat(topResult.lat),
      longitude: parseFloat(topResult.lon),
      address: location,
    }
  }
  catch (error) {
    console.error('❌ Geocoding error:', error)
    return null
  }
}

/**
 * Creates an event and mirrors it to the shared Google Calendar. Staff only.
 *
 * The calendar sync is a second step rather than part of the create, because
 * the Google event id only exists once Google has accepted the write — so a
 * successful sync means an extra `update` to store `calendarEventId` /
 * `calendarURL`. Sync is best-effort throughout: a volunteer who signed in with
 * email OTP has no Google token, and the event is still created without a
 * calendar entry (leaving `calendarEventId` null, which later edits and deletes
 * handle by skipping their own sync).
 */
export default defineEventHandler(async (event) => {
  // Creating events is staff-only.
  await requireRole(event, 'admin')

  const body = await readBody(event)

  // Validate required fields
  if (!body.title || !body.startTime || !body.endTime) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields: title, startTime, endTime',
    })
  }

  // Location is a required relation, so an address is required to create an event.
  // Prisma throws on a null unique lookup, so bail out before querying.
  if (!body.location) {
    throw createError({
      statusCode: 400,
      message: 'Missing required field: location',
    })
  }

  // check if location has already been fetched
  const locationData = await prisma.location.findUnique({
    where: {
      address: body.location,
    },
    select: {
      latitude: true,
      longitude: true,
      address: true,
    },
  }) || await geocodeLocation(body.location)

  console.log('📍 Location data from DB:', locationData)

  if (!locationData) {
    throw createError({
      statusCode: 400,
      message: 'Invalid location provided and geocoding failed',
    })
  }

  // The audience is one exclusive choice. Older clients that still send the
  // raw booleans get collapsed to the closest type.
  const audience = eventTypeToFlags(
    isEventType(body.eventType) ? body.eventType : eventTypeFromFlags(body),
  )

  const startTime = new Date(body.startTime)
  const endTime = new Date(body.endTime)

  // Time blocks are optional: an event created without them behaves exactly as
  // it did before this feature existed.
  //
  // Validated out here rather than inside the try below, because that catch
  // turns every error into a generic 500 — an admin needs to be told which
  // block is wrong, not just that something broke.
  const timeSlots = Array.isArray(body.timeSlots)
    ? parseTimeSlotPayload(body.timeSlots)
    : []

  if (timeSlots.length > 0) {
    assertEventAcceptsTimeSlots(audience)
    assertTimeSlotsValid(timeSlots, { startTime, endTime })
  }

  try {
    // Create the event in the database
    const newEvent = await prisma.event.create({
      data: {
        title: body.title,
        shortDesc: body.shortDesc || null,
        description: body.description || null,
        location: {
          connectOrCreate: {
            where: {
              address: body.location,
            },
            create: locationData,
          },
        },
        startTime,
        endTime,
        ...audience,
        // A nested create runs in the same implicit transaction as the event
        // insert, so the event and its blocks land together or not at all.
        timeSlots: {
          create: timeSlots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: slot.capacity,
            note: slot.note,
          })),
        },
      },
      include: {
        eventAssets: true,
        timeSlots: { orderBy: { startTime: 'asc' } },
      },
    })

    console.log('✅ Event created:', newEvent)

    // Best-effort: push the new event to the shared Google Calendar using the
    // creating volunteer's OAuth session. Failures never block event creation.
    const userId = event.context.session?.user?.id
    if (userId) {
      const calendarRef = await createCalendarEvent(userId, {
        title: newEvent.title,
        description: newEvent.description,
        location: body.location || null,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
      })

      if (calendarRef) {
        const synced = await prisma.event.update({
          where: { id: newEvent.id },
          data: {
            calendarEventId: calendarRef.id,
            calendarURL: calendarRef.htmlLink,
          },
          include: {
            eventAssets: true,
            timeSlots: { orderBy: { startTime: 'asc' } },
          },
        })
        setResponseStatus(event, 201)
        return synced
      }
    }

    setResponseStatus(event, 201)
    return newEvent
  }
  catch (error) {
    console.error('❌ Error creating event:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to create event',
    })
  }
})
