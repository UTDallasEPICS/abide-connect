import { requireRole } from '~~/server/utils/requireRole'
import { roundHours } from '#shared/utils/hours'
import type { ApprovalStatus, VolunteerArea } from '#server/utils/generated/prisma/client'

/**
 * Records volunteer hours on someone's behalf, from the admin member-detail
 * page. Admin only.
 *
 * `eventId` and `eventName` are alternatives, not a pair: hours logged against
 * a real event carry the id, while ad-hoc work carries only the free-text name.
 * Both are nullable, so a log can have neither.
 *
 * Defaults to `PENDING` even though an admin is creating it, keeping this
 * consistent with volunteer-submitted logs and leaving approval an explicit
 * step. `approvalStatus` is not validated against the enum — an unknown value
 * fails at the DB rather than as a 400.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin')

  const body = await readBody<{
    userId?: string
    eventId?: string
    eventName?: string
    date?: string
    hours?: number
    approvalStatus?: ApprovalStatus
    program?: VolunteerArea | null
    comment?: string
  }>(event)

  if (!body.userId) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  }
  if (!body.date) {
    throw createError({ statusCode: 400, statusMessage: 'Date is required' })
  }
  // Rounded before the check, not after, so a value that rounds away to zero
  // (0.004h, under 15 seconds) is rejected rather than stored as a 0-hour log.
  const hours = body.hours === undefined || body.hours === null ? null : roundHours(body.hours)

  if (hours === null || !Number.isFinite(hours) || hours <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A valid number of hours is required' })
  }

  // body.userId is the User.id — look up the corresponding Volunteer record,
  // since Volunteer_Hour_Log.volunteerId references Volunteer.id, not User.id
  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: body.userId },
    select: { id: true },
  })

  if (!volunteer) {
    throw createError({ statusCode: 404, statusMessage: 'Volunteer record not found for this user' })
  }

  const created = await prisma.volunteer_Hour_Log.create({
    data: {
      volunteerId: volunteer.id,
      eventId: body.eventId || null,
      eventName: body.eventName || null,
      date: new Date(body.date),
      hours,
      approvalStatus: body.approvalStatus ?? 'PENDING',
      // Optional: left null, the reports attribute these hours by falling back
      // to the volunteer's declared area (see `server/utils/reporting.ts`).
      program: body.program || null,
      comment: body.comment || null,
    },
  })

  return created
})
