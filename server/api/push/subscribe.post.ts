import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Registers the caller's browser/installed-PWA as a push target.
 *
 * Keyed on the push service `endpoint`, so re-subscribing the same device
 * updates the existing row rather than creating duplicates. Subscribing does
 * not by itself turn notifications on — that's the `pushEnabled` flag on the
 * user, set from /settings.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const body = await readBody(event)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const authKey = body?.keys?.auth

  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof authKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid push subscription' })
  }

  const userAgent = getRequestHeader(event, 'user-agent')?.slice(0, 255) ?? null

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    // An endpoint can be handed to a different account if two people share a
    // device, so reassign userId on conflict rather than leaving it stale.
    update: { userId: session.user.id, p256dh, auth: authKey, userAgent },
    create: { userId: session.user.id, endpoint, p256dh, auth: authKey, userAgent },
  })

  return { success: true }
})
