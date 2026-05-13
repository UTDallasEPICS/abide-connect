import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  if (!body.email) {
    throw createError({ statusCode: 400, message: 'Email is required' })
  }

  const rsvp = await prisma.guestRSVP.findFirst({
    where: {
      eventId: id,
      email: body.email.toLowerCase(),
      isVolunteer: body.isVolunteer ?? false,
    },
  })

  if (!rsvp) {
    throw createError({ statusCode: 404, message: 'RSVP not found' })
  }

  await prisma.guestRSVP.delete({
    where: { id: rsvp.id },
  })

  return { message: 'RSVP removed successfully' }
})
