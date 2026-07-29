import { requireRole } from '~~/server/utils/requireRole';

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