import webpush from 'web-push'
import prisma from './prisma'
import type { PushScope, PushSubscription } from './generated/prisma/client'

/**
 * Web Push (VAPID) delivery.
 *
 * Deliberately browser-only: an installed PWA subscribes through its own
 * service worker and the browser's push service handles the device hand-off,
 * so there is no APNs certificate or FCM project to maintain. On iOS this
 * requires the app to be added to the home screen (Safari 16.4+); in a plain
 * Safari tab `PushManager` isn't exposed and subscription is never offered.
 */

const publicKey = process.env.VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT ?? 'mailto:info@abidewomen.org'

/** True when VAPID keys are configured, i.e. push can actually be sent. */
export const pushConfigured = Boolean(publicKey && privateKey)

if (pushConfigured) {
  webpush.setVapidDetails(subject, publicKey!, privateKey!)
}
else {
  console.warn('[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications are disabled. Generate a pair with `pnpm push:keys`.')
}

export type PushPayload = {
  title: string
  body: string
  /** Path the notification opens when tapped, e.g. `/events/123`. */
  url?: string
  tag?: string
}

export type PushResult = { sent: number, failed: number }

/**
 * Delivers to a concrete set of subscriptions and prunes any the push service
 * reports as gone (404/410 — permission revoked, app uninstalled, endpoint
 * rotated).
 *
 * Best-effort: never throws, so a failing push can't roll back the DB write
 * that triggered it.
 */
async function deliver(subscriptions: PushSubscription[], payload: PushPayload): Promise<PushResult> {
  if (!pushConfigured || subscriptions.length === 0) return { sent: 0, failed: 0 }

  const body = JSON.stringify(payload)
  const expired: string[] = []
  let sent = 0
  let failed = 0

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      )
      sent++
    }
    catch (error: unknown) {
      failed++
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        expired.push(sub.id)
      }
      else {
        console.error('[push] send failed for subscription', sub.id, error)
      }
    }
  }))

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } })
  }

  return { sent, failed }
}

/**
 * Sends to every device of the given users, skipping users who have push
 * switched off or whose chosen scope doesn't cover this kind of notification.
 * This is the entry point feature code should use.
 */
export async function sendPushToUsers(
  userIds: string[],
  kind: 'GENERAL' | 'VOLUNTEER',
  payload: PushPayload,
): Promise<PushResult> {
  if (!pushConfigured || userIds.length === 0) return { sent: 0, failed: 0 }

  // BOTH opts into everything; otherwise the scope must match the kind.
  const scopes: PushScope[] = [kind, 'BOTH']

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { in: userIds },
      user: { pushEnabled: true, pushScope: { in: scopes } },
    },
  })

  return deliver(subscriptions, payload)
}

/**
 * Sends to one user's devices ignoring their scope preference — for the
 * "send a test notification" button in /settings, where the point is to verify
 * the device is wired up correctly.
 */
export async function sendPushToUserDevices(userId: string, payload: PushPayload): Promise<PushResult> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
  return deliver(subscriptions, payload)
}
