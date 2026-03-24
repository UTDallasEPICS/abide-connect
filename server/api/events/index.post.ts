import prisma from '~~/server/utils/prisma'

// Geocode location using Nominatim
async function geocodeLocation(location: string) {
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
    console.log("latitude:", parseFloat(topResult.lat), "longitude:", parseFloat(topResult.lon))
      
  } catch (error) {
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
      message: 'Missing required fields: title, startTime, endTime' 
    })
  }

  

  try {
    // Create the event in the database
    const newEvent = await prisma.event.create({
      data: {
        title: body.title,
        shortDesc: body.shortDesc || null,
        description: body.description || null,
        location: body.location || null,
        startTime: new Date(body.startTime),
        endTime: new Date(body.endTime),
        allowVolunteers: body.allowVolunteers || false,
        allowAttendees: body.allowAttendees || false,
        mobileClinicId: body.mobileClinicId || null,
      },
      include: {
        eventAssets: true
      }
    })

    console.log('✅ Event created:', newEvent)

    setResponseStatus(event, 201)
    return newEvent
    
  } catch (error) {
    console.error('❌ Error creating event:', error)
    throw createError({ 
      statusCode: 500, 
      message: 'Failed to create event' 
    })
  }
})