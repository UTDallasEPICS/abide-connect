import prisma from '#server/utils/prisma'

/**
 * The signed-in user's notifications, newest first, each flagged read/unread.
 * Backs the notification dropdown in `NavTop`.
 *
 * The `[id]` route parameter is never read; the notification set comes entirely
 * from the session. The file is named that way by accident and the route only
 * works because callers pass some placeholder segment.
 *
 * NOTE: the `catch` swallows errors and returns `undefined` rather than the
 * usual `{ success, notifications }`, so callers must tolerate that shape.
 */
export default eventHandler(async (event) => {
  try {
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }
    // `User_Notification` is keyed on `userId`, and `session.user.id` *is* a
    // `User.id` — no round-trip through `Volunteer` (which keys off a
    // different id space) is needed or correct here.
    const userId = session.user.id
    const notifications = await prisma.notification.findMany({
      where: {
        users: {
          some: {
            userId,
          },
        },
      },
      include: {
        users: {
          where: {
            userId,
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
