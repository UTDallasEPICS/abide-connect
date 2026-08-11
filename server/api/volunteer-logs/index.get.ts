import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole'

/**
 * Every volunteer's hour logs, newest first, for the admin review queue.
 * Admin only — the volunteer-facing view of their own logs is
 * `volunteer/logs.get.ts`.
 *
 * Note this is the second of two hour-log APIs: `volunteer-logs/*` is the
 * review queue (list + approve/deny), while `hour-log/*` is the per-member
 * editor on the admin member-detail page. They write the same table.
 *
 * `event` falls back to the free-text `eventName`, then to 'Manual submission',
 * because `eventId` is nullable — hours can be logged against work with no
 * `Event` row.
 */
export default eventHandler(async (event) => {
  await requireRole(event, 'admin')

  try {
    const logs = await prisma.volunteer_Hour_Log.findMany({
      include: {
        volunteer: {
          include: {
            user: true,
          },
        },
        event: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const formattedLogs = logs.map(log => ({
      id: String(log.id),
      name:
        log.volunteer.user?.name
        ?? log.volunteer.user?.email
        ?? 'Unknown',
      event: log.event?.title ?? log.eventName ?? 'Manual submission',
      date: log.date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      hours: log.hours,
      status: log.approvalStatus,
      comment: log.comment ?? '',
    }))

    return {
      success: true,
      logs: formattedLogs,
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch volunteer logs',
      cause: error,
    })
  }
})
