import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Events the current user has signed up for that haven't finished yet —
 * whether they signed up to help (`isVolunteer`) or just to attend.
 *
 * Scoped to the signed-in user's own RSVPs, so it needs no volunteer profile
 * and no approval: a plain user who registered for a public event sees it here
 * too. Guest RSVPs (name + email, no account) are deliberately excluded —
 * there's no session to tie them to.
 *
 * @example
 * const { data } = await useFetch('/api/user/upcoming-events')
 * // [{ id, title, startTime, endTime, address, isVolunteer, imageUrl }]
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.session) {
    return []
  }

  const rsvps = await prisma.rSVP.findMany({
    where: {
      userId: session.user.id,
      // An event stays "upcoming" until it's over, so something running today
      // doesn't drop off the list halfway through.
      event: { endTime: { gte: new Date() } },
    },
    include: {
      event: {
        include: {
          location: true,
          eventAssets: { take: 1 },
        },
      },
    },
    orderBy: { event: { startTime: 'asc' } },
  })

  return rsvps.map(({ event: e, isVolunteer }) => ({
    id: e.id,
    title: e.title,
    startTime: e.startTime,
    endTime: e.endTime,
    address: e.location?.address ?? null,
    isTraining: e.isTraining,
    isVolunteer,
    imageUrl: e.eventAssets[0]?.imageUrl ?? null,
  }))
})
