import { requireRole } from '~~/server/utils/requireRole'

/**
 * Switches an existing sign-up between attendee and volunteer, from the admin
 * member-detail page. Admin only.
 *
 * Only covers account-holder `RSVP` rows — guest sign-ups live in `GuestRSVP`
 * and aren't reachable here. Unlike `events/[id]/rsvp.post.ts`, this does not
 * re-check that the person is an approved volunteer: staff are trusted to
 * override, so it can mark someone a volunteer who couldn't have signed up as
 * one themselves.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin')

  const userId = getRouterParam(event, 'userId')
  const eventId = getRouterParam(event, 'eventId')
  if (!userId || !eventId) {
    throw createError({ statusCode: 400, statusMessage: 'User id and event id are required' })
  }

  const body = await readBody<{ isVolunteer?: boolean }>(event)

  const updated = await prisma.rSVP.update({
    where: { userId_eventId: { userId, eventId } },
    data: {
      ...(body.isVolunteer !== undefined && { isVolunteer: body.isVolunteer }),
    },
  })

  return updated
})
