import prisma from '~~/server/utils/prisma'

export default eventHandler(async (event) => {
  try {
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }
    const volunteerId = session.user.id
    const user = await prisma.volunteer.findUnique({
      where: {
        id: volunteerId,
      },
      select: {
        userId: true,
      },
    })
    const notifications = await prisma.notification.findMany({
      where: {
        users: {
          some: {
            userId: user?.userId ?? 'default',
          },
        },
      },
      include: {
        users: {
          where: {
            userId: user?.userId ?? 'default',
          },
          select: {
            isRead: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    console.log(notifications)

    // format the response
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      content: notification.content,
      createdAt: notification.createdAt,
      isRead: notification.users[0]?.isRead || false,
    }))
    return {
      success: true,
      notifications: formattedNotifications,
    }
  }
  catch (error) {
    console.error('Error fetching notifications:', error)
  }
})
