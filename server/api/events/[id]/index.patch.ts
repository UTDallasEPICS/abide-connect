import prisma from '#server/utils/prisma'
import { createCalendarEvent, updateCalendarEvent } from '#server/utils/googleCalendar'
import { requireRole } from '#server/utils/requireRole'
import { eventTypeToFlags, isEventType } from '#shared/utils/eventType'
import {
  assertEventAcceptsTimeSlots,
  assertTimeSlotsValid,
  parseTimeSlotPayload,
} from '#server/utils/timeSlots'

// Geocode location using Nominatim
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

  if (!locationData) {
    throw createError({
      statusCode: 400,
      message: 'Invalid location provided and geocoding failed',
    })
  }

  // Fetched before the try below so a missing event returns a real 404 —
  // that catch turns everything it sees into a 500.
  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // `location` and `mobileClinic` are relations handled separately below,
  // `eventType` is the client-facing name for the audience booleans, and
  // `timeSlots` is diffed by hand — none of them can be passed straight
  // through to Prisma.
  const {
    eventType,
    location: _location,
    mobileClinic: _mobileClinic,
    timeSlots: rawTimeSlots,
    ...eventFields
  } = body

  const audience = isEventType(eventType) ? eventTypeToFlags(eventType) : {}

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

  // The window blocks have to fit inside once this save lands: the incoming
  // times if the admin moved the event, the stored ones otherwise.
  const slotWindow = {
    startTime: eventFields.startTime ? new Date(eventFields.startTime) : foundEvent.startTime,
    endTime: eventFields.endTime ? new Date(eventFields.endTime) : foundEvent.endTime,
  }

  const existingSlots = await prisma.event_Time_Slot.findMany({
    where: { eventId: id },
    orderBy: { startTime: 'asc' },
  })

  // A missing `timeSlots` key means "leave the blocks alone". An array — even
  // an empty one — means "this is the complete set, remove anything else".
  //
  // Collapsing those two would be catastrophic: the inline editor on the event
  // page PATCHes title/description/times without ever mentioning blocks, so
  // every ordinary edit would delete every shift and cascade away every
  // signup on the event.
  const slotsProvided = Array.isArray(rawTimeSlots)
  const desiredSlots = slotsProvided ? parseTimeSlotPayload(rawTimeSlots) : []

  if (slotsProvided) {
    // An id that isn't one of this event's own blocks would otherwise let one
    // event's save rewrite another event's shifts.
    const existingIds = new Set(existingSlots.map(s => s.id))

    for (const slot of desiredSlots) {
      if (slot.id && !existingIds.has(slot.id)) {
        throw createError({
          statusCode: 400,
          message: 'A time block in this save does not belong to this event.',
        })
      }
    }
  }

  // Validate what will exist *after* the save rather than what was sent, so
  // narrowing the event window is caught even when the save says nothing about
  // blocks and leaves an existing one stranded outside its own event.
  const survivingSlots = slotsProvided ? desiredSlots : existingSlots

  if (survivingSlots.length > 0) {
    assertEventAcceptsTimeSlots({ ...foundEvent, ...audience })
    assertTimeSlotsValid(survivingSlots, slotWindow)
  }

  try {
    const updatedEvent = await prisma.$transaction(async (tx) => {
      await tx.event.update({
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
      })

      if (slotsProvided) {
        // Diff by id — never delete-all-and-recreate. Recreating would cascade
        // away every signup on the event, so an admin fixing a typo in the
        // title would unregister the entire roster, with nobody finding out
        // until people failed to show up.
        const keptIds = new Set(
          desiredSlots.map(s => s.id).filter((slotId): slotId is string => slotId !== null),
        )
        const removedIds = existingSlots
          .filter(slot => !keptIds.has(slot.id))
          .map(slot => slot.id)

        if (removedIds.length > 0) {
          // Deliberate removals only: the admin took these rows out of the
          // form. Their signups cascade with them, which is why the editor
          // warns before allowing it.
          await tx.event_Time_Slot.deleteMany({ where: { id: { in: removedIds } } })
        }

        for (const slot of desiredSlots) {
          const data = {
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: slot.capacity,
            note: slot.note,
          }

          if (slot.id) {
            await tx.event_Time_Slot.update({ where: { id: slot.id }, data })
          }
          else {
            await tx.event_Time_Slot.create({ data: { ...data, eventId: id } })
          }
        }
      }

      return tx.event.findUniqueOrThrow({
        where: { id },
        include: {
          eventAssets: true,
          location: true,
          timeSlots: { orderBy: { startTime: 'asc' } },
        },
      })
    })

    console.log('✅ Event updated:', updatedEvent.id)

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
          include: {
            eventAssets: true,
            location: true,
            timeSlots: { orderBy: { startTime: 'asc' } },
          },
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
