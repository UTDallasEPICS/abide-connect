import prisma from '#server/utils/prisma'
import { createCalendarEvent, updateCalendarEvent } from '#server/utils/googleCalendar'
import { requireRole } from '#server/utils/requireRole'
import { eventTypeToFlags, isEventType } from '#shared/utils/eventType'

/**
 * Resolves a free-text address to coordinates via OpenStreetMap's Nominatim.
 *
 * Duplicated verbatim from `server/api/events/index.post.ts` — if you change
 * one, change the other, or lift both into `server/utils/`.
 *
 * Only called on a cache miss (`Location` rows are keyed by address and
 * reused), since Nominatim's usage policy caps unauthenticated callers at
 * roughly one request per second and requires the `User-Agent` sent below.
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
 * Updates an event and keeps the shared Google Calendar in step. Staff only.
 *
 * Two behaviours worth knowing:
 *
 * - Unknown body keys are spread straight into the Prisma `update`, so this
 *   trusts the client's field names. `location`, `mobileClinic` and `eventType`
 *   are pulled out first because they need relation/flag handling rather than a
 *   direct column write.
 * - An event with no `calendarEventId` (created before sync existed, or by
 *   someone signed in via OTP) is *created* on the calendar here rather than
 *   patched, so editing is the path by which older events get backfilled.
 */
export default defineEventHandler(async (event) => {
  // Editing events is staff-only.
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  console.log(body)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  // check if location has already been fetched
  const locationData
    = (await prisma.location.findUnique({
      where: {
        address: body.location || '',
      },
      select: {
        latitude: true,
        longitude: true,
        address: true,
      },
    })) || (await geocodeLocation(body.location))

  if (!locationData) {
    throw createError({
      statusCode: 500,
      message: 'Failed to retrieve or create location data',
    })
  }

  console.log('📍 Location data from DB:', locationData)

  // Unreachable — the identical check above already returned (as a 500 rather
  // than this 400). Harmless, but only one of the two should survive.
  if (!locationData) {
    throw createError({
      statusCode: 400,
      message: 'Invalid location provided and geocoding failed',
    })
  }

  try {
    // Check if event exists
    const foundEvent = await prisma.event.findUnique({
      where: { id },
    })

    if (!foundEvent) {
      throw createError({ statusCode: 404, message: 'Event not found' })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mobileClinicUpdate: Record<string, any> = {}

    if (typeof body.mobileClinic === 'boolean') {
      if (body.mobileClinic) {
        if (!foundEvent.mobileClinicId) {
          mobileClinicUpdate.mobileClinic = {
            create: {},
          }
        }
      }
      else {
        if (foundEvent.mobileClinicId) {
          mobileClinicUpdate.mobileClinic = {
            disconnect: true,
          }
        }
      }
    }

    // `location` and `mobileClinic` are relations handled separately below,
    // and `eventType` is the client-facing name for the audience booleans —
    // none of them can be passed straight through to Prisma.
    const { eventType, location: _location, mobileClinic: _mobileClinic, ...eventFields } = body

    const audience = isEventType(eventType) ? eventTypeToFlags(eventType) : {}

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...eventFields,
        ...audience,
        location: {
          connectOrCreate: {
            where: {
              address: body.location || '',
            },
            create: locationData!,
          },
        },
        ...mobileClinicUpdate,
      },
      include: {
        eventAssets: true,
        location: true,
      },
    })

    console.log('✅ Event updated:', updatedEvent)

    // Best-effort: keep the shared Google Calendar in sync with the edit. If the
    // event was never pushed (e.g. created before sync existed, or by a
    // non-Google user), create it now; otherwise patch the existing entry.
    const userId = event.context.session?.user?.id
    if (userId) {
      const calendarInput = {
        title: updatedEvent.title,
        description: updatedEvent.description,
        location: updatedEvent.location?.address ?? null,
        startTime: updatedEvent.startTime,
        endTime: updatedEvent.endTime,
      }

      const calendarRef = foundEvent.calendarEventId
        ? await updateCalendarEvent(userId, foundEvent.calendarEventId, calendarInput)
        : await createCalendarEvent(userId, calendarInput)

      if (calendarRef && calendarRef.id !== foundEvent.calendarEventId) {
        return await prisma.event.update({
          where: { id },
          data: {
            calendarEventId: calendarRef.id,
            calendarURL: calendarRef.htmlLink,
          },
          include: { eventAssets: true, location: true },
        })
      }
    }

    return updatedEvent
  }
  catch (error) {
    console.error('❌ Error updating event:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to update event',
    })
  }
})
