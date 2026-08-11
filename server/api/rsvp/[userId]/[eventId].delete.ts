import { requireRole } from '~~/server/utils/requireRole';

/**
 * Removes someone's sign-up on their behalf, from the admin member-detail page.
 * Admin only.
 *
 * The staff counterpart to `events/[id]/rsvp.delete.ts`, which cancels the
 * caller's own. Account-holder `RSVP` rows only — guest sign-ups are in
 * `GuestRSVP` and cancelled through the event route instead.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');

  const userId = getRouterParam(event, 'userId');
  const eventId = getRouterParam(event, 'eventId');
  if (!userId || !eventId) {
    throw createError({ statusCode: 400, statusMessage: 'User id and event id are required' });
  }

  await prisma.rSVP.delete({ where: { userId_eventId: { userId, eventId } } });

  return { success: true };
});