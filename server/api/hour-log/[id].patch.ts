import { requireRole } from '~~/server/utils/requireRole';

function dehumanize(value: string): string {
  return value.toUpperCase().split(' ').join('_');
}

export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');

  const id = getRouterParam(event, 'id');
  
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Hour log id is required' });
  }

  const body = await readBody<{
    hours?: number;
    date?: string;
    approvalStatus?: string;
    comment?: string;
  }>(event);

  const updated = await prisma.volunteer_Hour_Log.update({
    where: { id: Number(id) },
    data: {
      ...(body.hours !== undefined && { hours: body.hours }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.approvalStatus !== undefined && { approvalStatus: dehumanize(body.approvalStatus) as any }),
      ...(body.comment !== undefined && { comment: body.comment || null }),
    },
  });

  return updated;
});