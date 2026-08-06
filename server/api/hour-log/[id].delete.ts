import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Hour log id is required' });
  }

  await prisma.volunteer_Hour_Log.delete({ where: { id: Number(id) } });

  return { success: true };
});