import prisma from '#server/utils/prisma'
import { auth } from '#server/utils/auth'

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
    orderBy: { createdAt: 'desc' }
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