import prisma from '#server/utils/prisma'

/**
 * Dismiss one notification for the signed-in user.
 *
 * Unlike the GET on this route — where `[id]` is decorative — here `[id]` is
 * the `Notification.id` being dismissed.
 *
 * Only the caller's own `User_Notification` join row is removed; the broadcast
 * `Notification` itself is shared with every other recipient and is left alone.
 * The delete is a `deleteMany` so dismissing something already gone (a double
 * click, a stale dropdown) is a no-op rather than a 500.
 */
export default eventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const notificationId = getRouterParam(event, 'id')
  if (!notificationId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing notification id',
    })
  }

  const { count } = await prisma.user_Notification.deleteMany({
    where: {
      userId: session.user.id,
      notificationId,
    },
  })

  return { success: true, dismissed: count }
})
