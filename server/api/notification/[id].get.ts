import prisma from '#server/utils/prisma'

/**
 * The signed-in user's notifications, newest first, each flagged read/unread.
 * Backs the /inbox page.
 *
 * BUG: the volunteer lookup below confuses the two id spaces. `session.user.id`
 * is a `User.id`, but it's passed as `where: { id: volunteerId }` on
 * `volunteer` — i.e. matched against `Volunteer.id`. The correct lookup is
 * `where: { userId: session.user.id }`, and in fact the round-trip through
 * `Volunteer` is unnecessary: `User_Notification` is keyed on `userId`, so
 * `session.user.id` can be used directly.
 *
 * As written the lookup almost always misses, `user` is null, and the
 * `?? 'default'` fallback quietly matches no rows — so the endpoint returns an
 * empty list rather than an error, which is why the failure isn't loud.
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
