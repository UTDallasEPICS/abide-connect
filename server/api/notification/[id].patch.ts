import prisma from '#server/utils/prisma'

/**
 * Set read state on one notification for the signed-in user.
 *
 * As with the DELETE on this route — and unlike the GET, where `[id]` is
 * decorative — `[id]` is the `Notification.id` being updated.
 *
 * Only the caller's own `User_Notification` join row is touched; `isRead` is
 * per-recipient, so this never affects anyone else's copy of the broadcast.
 * `updateMany` rather than `update` so marking something the user doesn't have
 * (a stale dropdown, a notification dismissed in another tab) reports zero rows
 * instead of throwing.
 *
 * Body: `{ isRead?: boolean }`, defaulting to true — the common call is "mark
 * read", but the flag is there so a row can be flipped back to unread.
 */
export default eventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) {
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

  const body = await readBody<{ isRead?: boolean }>(event).catch(() => ({}))
  const isRead = body?.isRead ?? true
  if (typeof isRead !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'isRead must be a boolean',
    })
  }

  const { count } = await prisma.user_Notification.updateMany({
    where: {
      userId: session.user.id,
      notificationId,
    },
    data: { isRead },
  })

  return { success: true, updated: count }
})
