import { defineCronHandler } from '#nuxt/cron'
import prisma from '#server/utils/prisma'

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
        where: { isVolunteer: true }
      }
    }
  })

  for (const event of events) {
    const durationHours = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60)

    for (const rsvp of event.participants) {
      if (!rsvp.volunteerId) continue

      await prisma.volunteer_Hour_Log.create({
        data: {
          volunteerId: rsvp.volunteerId,
          eventId: event.id,
          date: event.startTime,
          hours: durationHours,
          approvalStatus: 'PENDING'
        }
      })
    }

    await prisma.event.update({
      where: { id: event.id },
      data: { logsGenerated: true }
    })
  }
})