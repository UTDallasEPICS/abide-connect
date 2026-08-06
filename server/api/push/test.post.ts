import { auth } from '#server/utils/auth'
import { pushConfigured, sendPushToUserDevices } from '#server/utils/push'

/**
 * Fires a test notification at the caller's own devices, so a volunteer can
 * confirm push actually works on their phone before relying on it.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  if (!pushConfigured) {
    throw createError({ statusCode: 503, statusMessage: 'Push notifications are not configured on this server' })
  }

  const result = await sendPushToUserDevices(session.user.id, {
    title: 'Abide Connect',
    body: 'Push notifications are working on this device.',
    url: '/settings',
    tag: 'test-notification',
  })

  if (result.sent === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No active subscription for this device. Try turning notifications off and on again.' })
  }

  return result
})
