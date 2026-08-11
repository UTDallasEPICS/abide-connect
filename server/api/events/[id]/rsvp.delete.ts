import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Cancels a sign-up. Which record it removes is inferred from the body rather
 * than from an explicit parameter:
 *
 *   - no `email` in the body → deletes the caller's own `RSVP`
 *   - an `email` in the body → staff clearing a legacy `GuestRSVP`
 *
 * Both branches require a session. The guest branch is admin-only and exists
 * purely to clean up rows created before guest sign-up was removed — nothing
 * writes `GuestRSVP` any more. It used to be unauthenticated, which meant
 * knowing an address was enough to cancel that person's place, or to probe
 * whether a given address had signed up.
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

  // With no email in the body, the caller is cancelling their own sign-up —
  // the counterpart to the one-tap sign-up.
  if (!body?.email) {
    const session = await auth.api.getSession({ headers: event.headers })
    event.context.session = session

    if (!session?.session) {
      throw createError({ statusCode: 401, message: 'Please sign in to cancel your sign-up' })
    }

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

  // Removing someone else's registration by email is staff-only.
  await requireRole(event, 'admin')

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
