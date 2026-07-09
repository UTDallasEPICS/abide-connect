import prisma from '#server/utils/prisma'
import { auth } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  
  const logs = await prisma.volunteer_Hour_Log.findMany({
    where: { volunteerId: session?.user.id },
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