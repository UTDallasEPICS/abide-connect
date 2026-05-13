import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  if (!body.name || !body.email) {
    throw createError({ statusCode: 400, message: 'Name and email are required' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  const existing = await prisma.guestRSVP.findFirst({
    where: {
      eventId: id,
      email: body.email.toLowerCase(),
      isVolunteer: body.isVolunteer ?? false,
    },
  })

  if (existing) {
    throw createError({ statusCode: 409, message: 'You are already signed up for this event' })
  }

  const rsvp = await prisma.guestRSVP.create({
    data: {
      eventId: id,
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      isVolunteer: body.isVolunteer ?? false,
    },
  })

  setResponseStatus(event, 201)
  return rsvp
})
