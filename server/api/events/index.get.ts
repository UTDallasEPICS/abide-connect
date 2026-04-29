import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (_event) => {
  try {
    const allEvents = await prisma.event.findMany({
      include: {
        eventAssets: true,
        volunteerHours: true,
        participants: true,
        location: true,
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    console.log(`✅ Fetched ${allEvents.length} events`)
    return allEvents
    
  } catch {
    throw createError({ 
      statusCode: 500, 
      message: 'Failed to fetch events' 
    })
  }
})