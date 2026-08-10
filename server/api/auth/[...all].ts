import { auth } from '#server/utils/auth'
import { toWebRequest } from 'h3'

/**
 * Mounts better-auth's own router at `/api/auth/**`, which is where every
 * endpoint the library provides lives — `/sign-in/social`, `/callback/google`,
 * `/get-session`, `/sign-out`, the email-OTP routes, and so on. None of those
 * have files in this directory; they're all handled here.
 *
 * `toWebRequest` converts h3's Node-style event into the standard `Request`
 * that `auth.handler` expects. The sibling files in this folder are the app's
 * own additions (custom sign-up, rate-limited OTP requests), not overrides —
 * take care not to name one after a route better-auth already owns.
 */
export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event))
})
