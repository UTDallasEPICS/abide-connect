import { error } from 'node:console'
import prisma from '~~/server/utils/prisma'

// Geocode location using Nominatim
async function geocodeLocation( location: string) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`,
      {
        headers: {
          'User-Agent': 'Abide-Connect/1.0'
        }
      }
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
    
    return{
      latitude: parseFloat(topResult.lat),
      longitude: parseFloat(topResult.lon),
      address: location
    }
      
  } catch (error) {
    console.error('❌ Geocoding error:', error)
    return null
  }
}


export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

    //check if location has already been fetched
  const locationData = await prisma.location.findUnique({
    where: {
      address: body.location.address || null
    },
    select: {
      latitude: true,
      longitude: true,
      address: true
    }
  }) || await geocodeLocation(body.location.address)

  if (!locationData) {
    throw createError({ statusCode: 500, message: 'Failed to retrieve or create location data' })
  }

  console.log('📍 Location data from DB:', locationData)

  if (!locationData) {
    throw createError({ 
      statusCode: 400, 
      message: 'Invalid location provided and geocoding failed' 
    })
  }

  try {
    // Check if event exists
    const foundEvent = await prisma.event.findUnique({
      where: { id }
    })

    if (!foundEvent) {
      throw createError({ statusCode: 404, message: 'Event not found' })
    }

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...body,
        location: {
          connectOrCreate: {
            where: {
              address: body.location.address
            },
            create: locationData!
          }
        },
       
      },
      include: {
        eventAssets: true
      }
    })

    console.log('✅ Event updated:', updatedEvent)
    return updatedEvent
    
  } catch (error) {
    console.error('❌ Error updating event:', error)
    throw createError({ 
      statusCode: 500, 
      message: 'Failed to update event' 
    })
  }
})
