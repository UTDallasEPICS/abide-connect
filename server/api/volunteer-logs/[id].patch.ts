import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole'

/**
 * Approves or denies a submitted hour log, with an optional reviewer comment.
 * Admin only.
 *
 * `status` is written through unvalidated, so it must already be a member of
 * the `ApprovalStatus` enum (`PENDING` / `APPROVED` / `REJECTED`) — anything
 * else fails at the database and surfaces as a 500. Note that unlike
 * `hour-log/[id].patch.ts`, no `dehumanize` step runs here, so callers must
 * send the raw enum value rather than a display string.
 *
 * `comment` is unconditionally overwritten: omitting it clears any existing
 * reviewer note rather than leaving it in place.
 *
 * `approvedAt` is stamped on the first decision and left alone afterwards, so
 * the approval-latency stat on `/admin/reports` measures how long the volunteer
 * waited for an answer rather than when a reviewer last touched the row.
 * Sending the log back to PENDING clears it, since it is waiting again.
 */
export default eventHandler(async (event) => {
  await requireRole(event, 'admin')

  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { status, comment } = body

    if (!id || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Log ID and status are required',
      })
    }

    const existing = await prisma.volunteer_Hour_Log.findUnique({
      where: { id: Number(id) },
      select: { approvedAt: true },
    })

    const updated = await prisma.volunteer_Hour_Log.update({
      where: { id: Number(id) },
      data: {
        approvalStatus: status,
        comment: comment ?? null,
        approvedAt: status === 'PENDING'
          ? null
          : existing?.approvedAt ?? new Date(),
      },
    })

    return {
      success: true,
      log: updated,
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update volunteer log',
      cause: error,
    })
  }
})
