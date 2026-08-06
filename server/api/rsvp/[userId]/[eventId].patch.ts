import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');

  const userId = getRouterParam(event, 'userId');
  const eventId = getRouterParam(event, 'eventId');
  if (!userId || !eventId) {
    throw createError({ statusCode: 400, statusMessage: 'User id and event id are required' });
  }

  const body = await readBody<{ isVolunteer?: boolean }>(event);

  const updated = await prisma.rSVP.update({
    where: { userId_eventId: { userId, eventId } },
    data: {
      ...(body.isVolunteer !== undefined && { isVolunteer: body.isVolunteer }),
    },
  });

  return updated;
});