import prisma from '#server/utils/prisma'
import { auth } from '#server/utils/auth'

/**
 * The signed-in volunteer's own hour logs, formatted for display.
 *
 * Returns an empty list rather than a 401/404 for signed-out users and for
 * accounts with no volunteer profile, so the page renders an empty state
 * instead of an error.
 *
 * The admin-facing counterpart is `volunteer-logs/index.get.ts`, which returns
 * every volunteer's logs.
 *
 * BUG: `log.event.title` assumes every log has an event, but `eventId` is
 * nullable — `hour-log/create.post.ts` and `volunteer-logs/index.post.ts` both
 * create logs against a free-text `eventName` instead. Any such log makes this
 * throw a 500. It needs the same fallback the admin endpoint uses:
 * `log.event?.title ?? log.eventName ?? 'Manual submission'`.
 *
 * Dates are pre-formatted to `en-US` here rather than sent as ISO strings, so
 * the response is display-ready but not re-parseable by the client.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })

  if (!session?.session) {
    return { logs: [] }
  }

  // Hour logs hang off the Volunteer profile, not the account — someone who
  // never applied to volunteer simply has none.
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!volunteer) {
    return { logs: [] }
  }

  const logs = await prisma.volunteer_Hour_Log.findMany({
    where: { volunteerId: volunteer.id },
    include: { event: true },
    orderBy: { createdAt: 'desc' },
  })

  const formattedLogs = logs.map(log => ({
    id: String(log.id),
    event: log.event.title,
    date: log.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    hours: log.hours,
    approvalStatus: log.approvalStatus,
    comment: log.comment ?? '',
  }))

  return { logs: formattedLogs }
})
