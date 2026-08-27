import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { revalidateGoogleGrant } from '#server/utils/idpRevalidation'
import type { H3Event } from 'h3'

/**
 * Enforces that the current request comes from a logged-in user with the
 * given role. Throws a 401 if there's no session, or a 403 if the user is
 * logged in but lacks the role. Returns the session on success so you can
 * use it right after without fetching it again.
 *
 * For `admin` there is a third check: the Google account behind the session
 * must still be live in Abide's Workspace (see `idpRevalidation.ts`). Holding a
 * valid session cookie is not on its own enough to stay an admin.
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

  // Only admin is re-checked against Google. Ordinary users and volunteers have
  // no elevated access to strip, and most of them have no Google grant to check.
  // Throws 401 and drops the session if Workspace has since offboarded them.
  if (role.toLowerCase() === 'admin') {
    await revalidateGoogleGrant(session.user.id)
  }

  return session
}
