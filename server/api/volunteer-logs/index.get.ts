import prisma from "~~/server/utils/prisma";

export default eventHandler(async (event) => {
  try {
    const logs = await prisma.volunteer_Hour_Log.findMany({
      include: {
        volunteer: {
          include: {
            user: true
          }
        },
        event: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    const formattedLogs = logs.map(log => ({
      id: String(log.id),
      name: log.volunteer.user?.name ?? log.volunteer.user?.contactEmail ?? 'Unknown',
      event: log.event.title,
      date: log.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      hours: log.hours,
      status: log.approvalStatus,
      comment: log.comment ?? ''
    }))

    return {
      success: true,
      logs: formattedLogs
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch volunteer logs",
      cause: error
    })
  }
})