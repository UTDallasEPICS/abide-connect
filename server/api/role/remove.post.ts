import { readBody, defineEventHandler, createError } from 'h3'
import { requireRole } from '#server/utils/requireRole'

// Only these two roles can be removed via this endpoint.
// ADMIN is intentionally excluded.
const REMOVABLE_ROLES = ['USER', 'VOLUNTEER'] as const
type RemovableRole = (typeof REMOVABLE_ROLES)[number]

/**
 * Revokes a role from a user, from the admin member-management screen.
 *
 * Admin only, like the sibling `add.post.ts`. Stripping USER locks an account
 * out of the app entirely (`app/middleware/auth.global.ts` gates on roles), so
 * the `requireRole` call below is load-bearing — there is no global middleware
 * behind it.
 *
 * Note this hard-deletes the `User_Role` row rather than setting
 * `active: false`, so the grant history is lost; `add.post.ts` recreates it on
 * re-grant.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody<{ userId?: string; role?: string }>(event)
  const userId = body.userId
  const role = body.role?.toUpperCase()

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  if (!role || !REMOVABLE_ROLES.includes(role as RemovableRole)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Role must be one of: ${REMOVABLE_ROLES.join(', ')}`,
    })
  }

  try {
    await prisma.user_Role.delete({
      where: { userId_role: { userId, role: role as RemovableRole } },
    })
  } catch {
    // Prisma throws if the row doesn't exist (P2025) — surface as 404
    throw createError({
      statusCode: 404,
      statusMessage: 'User does not have that role assigned',
    })
  }

  return { userId, role, deleted: true }
})