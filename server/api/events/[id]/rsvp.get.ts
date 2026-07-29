import prisma from '#server/utils/prisma'

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

  const guestRsvps = await prisma.guestRSVP.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'asc' },
  })

  // Signed-in sign-ups live in a separate table, but staff want one list.
  const userRsvps = await prisma.rSVP.findMany({
    where: { eventId: id },
    include: { user: { select: { name: true, email: true } } },
  })

  const rsvps = [
    ...userRsvps.map(r => ({
      id: r.userId,
      name: r.user?.name ?? '',
      email: r.user?.email ?? '',
      isVolunteer: r.isVolunteer,
      isGuest: false,
    })),
    ...guestRsvps.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      isVolunteer: r.isVolunteer,
      isGuest: true,
    })),
  ]

  const volunteers = rsvps.filter(r => r.isVolunteer)
  const attendees = rsvps.filter(r => !r.isVolunteer)

  return {
    volunteerCount: volunteers.length,
    attendeeCount: attendees.length,
    volunteers,
    attendees,
  }
})
