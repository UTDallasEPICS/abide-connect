import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { revalidateGoogleGrant } from '#server/utils/idpRevalidation'
import { enforceAdminSessionAge } from '#server/utils/sessionPolicy'
import type { H3Event } from 'h3'

/**
 * Enforces that the current request comes from a logged-in user with the
 * given role. Throws a 401 if there's no session, or a 403 if the user is
 * logged in but lacks the role. Returns the session on success so you can
 * use it right after without fetching it again.
 *
 * Asking for `admin` adds two checks on top of the role itself, because holding
 * a valid session cookie is not on its own enough to stay an admin: the session
 * must be inside the admin age ceiling (`sessionPolicy.ts`), and the Google
 * account behind it must still be live in Abide's Workspace
 * (`idpRevalidation.ts`). Either one failing drops the session and 401s.
 *
 * @example
 * export default defineEventHandler(async (event) => {
 *   const session = await requireRole(event, 'admin')
 *   // session.user.id is safe to use here
 * })
 */
export async function requireRole(event: H3Event, role: string) {
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.session) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const userRoles = await prisma.user_Role.findMany({
    where: { userId: session.user.id, active: true },
  })
  const roles = userRoles.map(r => r.role.toLowerCase())

  if (!roles.includes(role.toLowerCase())) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  // Two extra checks that apply to admin only. Ordinary users and volunteers
  // skip both: they have no elevated access to bound, and most of them signed in
  // by OTP and have no Google grant to check in the first place.
  //
  // Age first — it's local arithmetic, so a session that is already past its
  // ceiling is rejected without spending a network round-trip on Google.
  if (role.toLowerCase() === 'admin') {
    await enforceAdminSessionAge(session.session.token, session.session.createdAt)
    await revalidateGoogleGrant(session.user.id)
  }

  return session
}
