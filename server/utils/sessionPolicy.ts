import { createError } from 'h3'
import prisma from './prisma'

/**
 * The hard ceiling on how long an admin session stays privileged, measured from
 * sign-in rather than from last use.
 *
 * Sessions themselves slide: better-auth is configured in `auth.ts` to push
 * `expiresAt` forward as people use the app, so an ordinary volunteer or donor
 * stays signed in indefinitely while they keep coming back. That is the right
 * trade for an account whose worst case is seeing their own hours.
 *
 * Admin access doesn't get that. This cap is what stops a privileged session
 * from renewing itself forever, and it's deliberately independent of the Google
 * check in `idpRevalidation.ts` — that one answers "is this person still
 * staff?", this one bounds how long a single stolen or forgotten cookie can act
 * as an admin even while the answer to that question is still yes.
 */
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Throws a 401 if an admin's session has outlived `ADMIN_SESSION_MAX_AGE_MS`,
 * after deleting that session so the next request lands on the login page.
 *
 * Only the session that hit the cap is deleted, not every session the user has.
 * Each sign-in gets its own window, so a newer session on another device is
 * still legitimately inside its own — unlike a revoked Google grant, where the
 * person is gone and all of their sessions go with them.
 */
export async function enforceAdminSessionAge(
  sessionToken: string,
  createdAt: Date,
): Promise<void> {
  const createdMs = new Date(createdAt).getTime()

  // A timestamp we can't read means the schema moved under us. Log it loudly
  // and let the request through: the Google revalidation is the primary control
  // here, and failing closed on a malformed field would lock out every admin at
  // once.
  if (Number.isNaN(createdMs)) {
    console.warn('[session] Admin session has an unreadable createdAt — age cap not enforced')
    return
  }

  if (Date.now() - createdMs <= ADMIN_SESSION_MAX_AGE_MS) return

  await prisma.session.deleteMany({ where: { token: sessionToken } })
  console.warn(
    `[session] Revoked an admin session that reached the ${ADMIN_SESSION_MAX_AGE_MS / 3600000}h cap`,
  )
  throw createError({ statusCode: 401, message: 'Unauthorized' })
}
