import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');

  const body = await readBody(event);
  const { userId, eventId, date, hours, approvalStatus, comment } = body;

  if (!userId || !eventId || !date || hours === undefined || hours === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'userId, eventId, date, and hours are required',
    });
  }

  const parsedHours = Number(hours);
  if (Number.isNaN(parsedHours) || parsedHours <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'hours must be a positive number' });
  }

  const volunteer = await prisma.volunteer.findUnique({ where: { userId } });
  if (!volunteer) {
    throw createError({ statusCode: 404, statusMessage: 'Volunteer profile not found for this user' });
  }

  const eventExists = await prisma.event.findUnique({ where: { id: eventId } });
  if (!eventExists) {
    throw createError({ statusCode: 404, statusMessage: 'Event not found' });
  }

  const hourLog = await prisma.volunteer_Hour_Log.create({
    data: {
      volunteerId: volunteer.id,
      eventId,
      date: new Date(date),
      hours: parsedHours,
      approvalStatus: approvalStatus ?? 'PENDING',
      comment: comment || undefined,
    },
  });

  return hourLog;
});