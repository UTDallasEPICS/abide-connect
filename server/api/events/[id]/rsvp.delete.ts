import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  // With no email in the body, a logged-in user is cancelling their own
  // sign-up — the counterpart to the one-tap volunteer sign-up.
  if (!body?.email) {
    const session = await auth.api.getSession({ headers: event.headers })
    event.context.session = session

    if (session?.session) {
      const own = await prisma.rSVP.findUnique({
        where: { userId_eventId: { userId: session.user.id, eventId: id } },
      })

      if (!own) {
        throw createError({ statusCode: 404, message: 'RSVP not found' })
      }

      await prisma.rSVP.delete({
        where: { userId_eventId: { userId: session.user.id, eventId: id } },
      })

      return { message: 'RSVP removed successfully' }
    }
  }

  if (!body?.email) {
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
