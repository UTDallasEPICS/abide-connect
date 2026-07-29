import prisma from '#server/utils/prisma'
import { eventTypeToFlags, isEventType } from '#shared/utils/eventType'

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
