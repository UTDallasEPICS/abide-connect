import { requireRole } from '~~/server/utils/requireRole';

/**
 * `Prefer Not To Say` → `PREFER_NOT_TO_SAY`. Inverse of the `humanize` in
 * `user/[id].get.ts` — that endpoint prettifies `approvalStatus` for display,
 * so an edit form round-trips the display value back here and it has to be
 * converted to the enum again.
 */
function dehumanize(value: string): string {
  return value.toUpperCase().split(' ').join('_');
}

/**
 * Edits an existing hour log. Admin only — this is the approve/deny path as
 * well as the correction path, since `approvalStatus` is just another field.
 *
 * Every field is conditional on being present in the body, so this is a true
 * partial update: omitting a key leaves it alone, and passing an empty string
 * for `eventId`/`eventName`/`comment` clears it to null.
 *
 * `id` is `Number`-cast because `Volunteer_Hour_Log.id` is an autoincrement int
 * while route params always arrive as strings.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin');
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Hour log id is required' });
  }

  const body = await readBody<{
    eventId?: string | null;
    eventName?: string;
    hours?: number;
    date?: string;
    approvalStatus?: string;
    comment?: string;
  }>(event);

  const updated = await prisma.volunteer_Hour_Log.update({
    where: { id: Number(id) },
    data: {
      ...(body.eventId !== undefined && { eventId: body.eventId || null }),
      ...(body.eventName !== undefined && { eventName: body.eventName || null }),
      ...(body.hours !== undefined && { hours: body.hours }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.approvalStatus !== undefined && { approvalStatus: dehumanize(body.approvalStatus) as any }),
      ...(body.comment !== undefined && { comment: body.comment || null }),
    },
  });

  return updated;
});