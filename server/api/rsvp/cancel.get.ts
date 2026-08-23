import prisma from '#server/utils/prisma'
import { formatEventWhen } from '#server/utils/eventTime'
import { verifyRsvpCancelToken } from '#server/utils/rsvpCancelToken'

/**
 * What the `/rsvp/cancel` page shows before it asks "are you sure?".
 *
 * Authorisation is the token itself (see `rsvpCancelToken.ts`) — that's the
 * point of it, since a guest who signed up without an account has no session to
 * check. Nothing here reveals more than the event page the same email already
 * links to, and a token names exactly one sign-up.
 */
export default defineEventHandler(async (event) => {
  const claim = verifyRsvpCancelToken(getQuery(event).token as string | undefined)

  if (!claim) {
    throw createError({ statusCode: 400, message: 'This cancellation link is invalid or has expired' })
  }

  const include = {
    event: {
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        location: { select: { address: true } },
      },
    },
  }

  const rsvp = claim.type === 'guest'
    ? await prisma.guestRSVP.findUnique({ where: { id: claim.guestRsvpId }, include })
    : await prisma.rSVP.findUnique({
        where: { userId_eventId: { userId: claim.userId, eventId: claim.eventId } },
        include: { ...include, user: { select: { name: true } } },
      })

  // A sign-up that's already gone isn't an error — someone clicking the link
  // twice, or cancelling in the app first, should see "you're not signed up"
  // rather than a failure.
  if (!rsvp) {
    return { status: 'gone' as const }
  }

  return {
    status: 'active' as const,
    name: 'name' in rsvp ? rsvp.name : rsvp.user?.name ?? null,
    isVolunteer: rsvp.isVolunteer,
    event: {
      id: rsvp.event.id,
      title: rsvp.event.title,
      when: formatEventWhen(rsvp.event.startTime, rsvp.event.endTime),
      location: rsvp.event.location?.address ?? null,
    },
  }
})
