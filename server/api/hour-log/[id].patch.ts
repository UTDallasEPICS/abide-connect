import { requireRole } from '~~/server/utils/requireRole'
import type { ApprovalStatus, VolunteerArea } from '#server/utils/generated/prisma/client'

/**
 * `Prefer Not To Say` → `PREFER_NOT_TO_SAY`. Inverse of the `humanize` in
 * `user/[id].get.ts` — that endpoint prettifies `approvalStatus` for display,
 * so an edit form round-trips the display value back here and it has to be
 * converted to the enum again.
 */
function dehumanize(value: string): ApprovalStatus {
  return value.toUpperCase().split(' ').join('_') as ApprovalStatus
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
 *
 * `program` is the grant-reporting dimension read by `/admin/reports/impact`;
 * setting it here is what turns an inferred attribution into a stated one.
 * `approvedAt` follows the same rule as the review queue — stamped once, on the
 * first decision, and cleared if the log goes back to PENDING.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Hour log id is required' })
  }

  const body = await readBody<{
    eventId?: string | null
    eventName?: string
    hours?: number
    date?: string
    approvalStatus?: string
    program?: string | null
    comment?: string
  }>(event)

  const nextStatus = body.approvalStatus !== undefined
    ? dehumanize(body.approvalStatus)
    : undefined

  const existing = nextStatus === undefined
    ? null
    : await prisma.volunteer_Hour_Log.findUnique({
        where: { id: Number(id) },
        select: { approvedAt: true },
      })

  const updated = await prisma.volunteer_Hour_Log.update({
    where: { id: Number(id) },
    data: {
      ...(body.eventId !== undefined && { eventId: body.eventId || null }),
      ...(body.eventName !== undefined && { eventName: body.eventName || null }),
      ...(body.hours !== undefined && { hours: body.hours }),
      ...(body.date !== undefined && { date: new Date(body.date) }),
      ...(body.program !== undefined && { program: body.program as VolunteerArea || null }),
      ...(nextStatus !== undefined && {
        approvalStatus: nextStatus,
        approvedAt: nextStatus === 'PENDING' ? null : existing?.approvedAt ?? new Date(),
      }),
      ...(body.comment !== undefined && { comment: body.comment || null }),
    },
  })

  return updated
})
