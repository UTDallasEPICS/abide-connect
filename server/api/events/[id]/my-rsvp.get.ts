import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * The current user's own RSVP for an event, or null if they haven't signed up
 * (or aren't logged in). Lets the event page show "you're signed up" instead
 * of offering the sign-up button again.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.session) {
    return null
  }

  const rsvp = await prisma.rSVP.findUnique({
    where: { userId_eventId: { userId: session.user.id, eventId: id } },
    select: { isVolunteer: true },
  })

  return rsvp
})
