import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');

  const body = await readBody<{
    userId?: string;
    eventId?: string;
    eventName?: string;
    date?: string;
    hours?: number;
    approvalStatus?: string;
    comment?: string;
  }>(event);

  if (!body.userId) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' });
  }
  if (!body.date) {
    throw createError({ statusCode: 400, statusMessage: 'Date is required' });
  }
  if (body.hours === undefined || body.hours === null || body.hours <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A valid number of hours is required' });
  }

  // body.userId is the User.id — look up the corresponding Volunteer record,
  // since Volunteer_Hour_Log.volunteerId references Volunteer.id, not User.id
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: body.userId },
    select: { id: true },
  });

  if (!volunteer) {
    throw createError({ statusCode: 404, statusMessage: 'Volunteer record not found for this user' });
  }

  const created = await prisma.volunteer_Hour_Log.create({
    data: {
      volunteerId: volunteer.id,
      eventId: body.eventId || null,
      eventName: body.eventName || null,
      date: new Date(body.date),
      hours: body.hours,
      approvalStatus: (body.approvalStatus as any) ?? 'PENDING',
      comment: body.comment || null,
    },
  });

  return created;
});