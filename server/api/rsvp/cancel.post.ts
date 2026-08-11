import prisma from '#server/utils/prisma'
import { verifyRsvpCancelToken } from '#server/utils/rsvpCancelToken'

/**
 * Cancels the sign-up named by a signed cancel token — the "can't make it?"
 * button in the confirmation and reminder emails.
 *
 * POST rather than GET because mail clients, link scanners and corporate
 * security gateways fetch every URL in a message: a cancel-on-GET link would
 * quietly drop people from events they still meant to attend. The emailed link
 * opens `/rsvp/cancel`, which posts here only after a real click.
 *
 * Idempotent — cancelling something already cancelled returns `gone`, so a
 * second click reads as "you're not signed up" rather than an error.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const claim = verifyRsvpCancelToken(body?.token)

  if (!claim) {
    throw createError({ statusCode: 400, message: 'This cancellation link is invalid or has expired' })
  }

  if (claim.type === 'guest') {
    const existing = await prisma.guestRSVP.findUnique({ where: { id: claim.guestRsvpId } })
    if (!existing) return { status: 'gone' as const }

    await prisma.guestRSVP.delete({ where: { id: claim.guestRsvpId } })
    return { status: 'cancelled' as const, eventId: existing.eventId }
  }

  const key = { userId_eventId: { userId: claim.userId, eventId: claim.eventId } }
  const existing = await prisma.rSVP.findUnique({ where: key })
  if (!existing) return { status: 'gone' as const }

  await prisma.rSVP.delete({ where: key })
  return { status: 'cancelled' as const, eventId: claim.eventId }
})
