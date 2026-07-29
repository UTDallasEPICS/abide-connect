import prisma from '#server/utils/prisma'
import { eventTypeFromFlags, eventTypeToFlags, isEventType } from '#shared/utils/eventType'

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

export default defineEventHandler(async (event) => {
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
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        ...audience,
      },
      include: {
        eventAssets: true,
      },
    })

    console.log('✅ Event created:', newEvent)

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
