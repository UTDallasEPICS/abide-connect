import { parseZonedDate } from '#shared/utils/eventTime'
import prisma from '#server/utils/prisma'
import { auth } from '#server/utils/auth'

/**
 * Lets a volunteer log their own hours. Always created as PENDING — the
 * volunteer submits, staff approve via `volunteer-logs/[id].patch.ts`.
 *
 * Authorization is implicit rather than a `requireRole` call: the log is
 * attached to whatever `Volunteer` row belongs to the session, so a caller can
 * only ever log hours against themselves, and someone without a volunteer
 * profile gets a 403.
 *
 * `eventId` and `eventName` are alternatives — a log points at a real event or
 * carries a free-text description, and both are nullable.
 *
 * The admin equivalent, which logs hours on someone else's behalf, is
 * `hour-log/create.post.ts`.
 */
export default defineEventHandler(async (event) => {
  try {
    const session = await auth.api.getSession({ headers: event.headers })
    const body = await readBody(event)
    const { eventId, eventName, date, hours } = body

    if (!date || !hours) {
      throw createError({
        statusCode: 400,
        statusMessage: 'date and hours are required',
      })
    }

    const volunteer = await prisma.volunteer.findUnique({
      where: { userId: session?.user.id },
    })

    if (!volunteer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'User is not a registered volunteer',
      })
    }

    const log = await prisma.volunteer_Hour_Log.create({
      data: {
        volunteerId: volunteer.id,
        eventId: eventId,
        eventName: eventName,
        date: parseZonedDate(date),
        hours: hours,
        approvalStatus: 'PENDING',
      },
    })

    return {
      success: true,
      log: log,
    }
  }
  catch (error) {
    const err = error as { statusCode?: number }
    if (err.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get session',
      cause: error,
    })
  }
})
