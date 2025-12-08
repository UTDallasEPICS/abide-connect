import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const allEvents = await prisma.event.findMany({
      include: {
        eventAssets: true,
        volunteerHours: true,
        participants: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    console.log(`✅ Fetched ${allEvents.length} events`)
    return allEvents
    
  } catch (error) {
    console.error('❌ Error fetching events:', error)
    throw createError({ 
      statusCode: 500, 
      message: 'Failed to fetch events' 
    })
  }
})