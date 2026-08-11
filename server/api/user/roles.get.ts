import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Returns the current user's active roles, lowercased.
 * Used by client-side route middleware since Prisma can't run in the browser.
 * Returns an empty array if there's no active session.
 *
 * @example
 * const roles = await $fetch('/api/user/roles')
 * // ['admin', 'volunteer']
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.session) {
    return []
  }

  const userRoles = await prisma.user_Role.findMany({
    where: { userId: session.user.id, active: true },
  })

  const rolesList = userRoles.map(r => r.role.toLowerCase())

  return rolesList
})
