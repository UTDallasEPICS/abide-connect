import { defineCronHandler } from '#nuxt/cron'
import prisma from '#server/utils/prisma'
import { volunteerHoursForEvent } from '#server/utils/volunteerHours'

/**
 * Turns finished events into pending volunteer hour logs for staff to approve.
 *
 * The hours themselves are worked out by `volunteerHoursForEvent`, which
 * credits volunteers for the time blocks they claimed on events that have
 * them, and falls back to the full event duration on events that don't.
 *
 * `Event.logsGenerated` is the idempotency guard.
 */
export default defineCronHandler('daily', async () => {
  const now = new Date()

  // Find all ended events that haven't had logs generated yet
  const events = await prisma.event.findMany({
    where: {
      endTime: { lt: now },
      logsGenerated: false,
      allowVolunteers: true,
    },
    include: {
      participants: {
        where: { isVolunteer: true },
      },
      timeSlots: {
        include: {
          // Cancelled and admin-removed signups are kept in the table; only
          // confirmed ones were actually worked.
          signups: { where: { status: 'CONFIRMED' } },
        },
      },
    },
  })

  for (const event of events) {
    const worked = volunteerHoursForEvent(event)

    // One transaction per event, so a crash part-way through can't leave logs
    // written with `logsGenerated` still false — the next run would then
    // create every one of them a second time.
    await prisma.$transaction([
      ...worked.map(({ volunteerId, hours, blocks }) =>
        prisma.volunteer_Hour_Log.create({
          data: {
            volunteerId,
            eventId: event.id,
            date: event.startTime,
            hours,
            approvalStatus: 'PENDING',
            // An admin looking at 2 hours on an all-day event needs to see why.
            comment: blocks > 0
              ? `Auto-generated from ${blocks} time block${blocks === 1 ? '' : 's'}.`
              : null,
          },
        }),
      ),
      prisma.event.update({
        where: { id: event.id },
        data: { logsGenerated: true },
      }),
    ])
  }
})
