import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Cancels a sign-up. Mirrors `rsvp.post.ts`, and which record it removes is
 * inferred the same way rather than from an explicit parameter:
 *
 *   - no `email` in the body + a session → deletes that user's own `RSVP`
 *   - an `email` in the body            → deletes the matching `GuestRSVP`
 *
 * The guest branch is unauthenticated by necessity (guests have no account to
 * authenticate with), so knowing an address is enough to cancel that person's
 * place. Acceptable for cancelling a free event; it does mean a caller who
 * guesses an attendee's email can remove them, and it also lets one probe
 * whether a given address signed up, since a miss 404s.
 *
 * `readBody` is `.catch`-ed because a logged-in cancel legitimately sends no
 * body at all, which would otherwise throw on parse.
 */
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
