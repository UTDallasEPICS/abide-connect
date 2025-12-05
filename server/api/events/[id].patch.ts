import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
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
        title: body.title,
        shortDesc: body.shortDesc,
        description: body.description,
        location: body.location,
        startTime: body.startTime ? new Date(body.startTime) : undefined,
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        allowVolunteers: body.allowVolunteers,
        allowAttendees: body.allowAttendees,
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
