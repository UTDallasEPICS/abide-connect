import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  const rsvps = await prisma.guestRSVP.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'asc' },
  })

  const volunteers = rsvps.filter(r => r.isVolunteer)
  const attendees = rsvps.filter(r => !r.isVolunteer)

  return {
    volunteerCount: volunteers.length,
    attendeeCount: attendees.length,
    volunteers,
    attendees,
  }
})
