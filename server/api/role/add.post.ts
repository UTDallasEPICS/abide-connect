import { readBody, defineEventHandler, createError } from 'h3'

// ADMIN is intentionally excluded — admin status is not manageable
// through this quick-action UI.
const ADDABLE_ROLES = ['USER', 'VOLUNTEER'] as const
type AddableRole = (typeof ADDABLE_ROLES)[number]

/**
 * Grants a role to a user, from the admin member-management screen.
 *
 * SECURITY: this handler performs no authorization. It never calls
 * `requireRole`, and `server/middleware/authenticated.ts` is a no-op, so any
 * caller — including an unauthenticated one — can POST a `userId` and grant
 * VOLUNTEER to themselves or anyone else. The admin-only restriction currently
 * exists solely in the UI that calls it, which is not enforcement.
 *
 * The `ADDABLE_ROLES` allowlist limits the blast radius to USER/VOLUNTEER
 * (ADMIN cannot be granted here), but VOLUNTEER still unlocks volunteer-only
 * events and hour logging. This wants `await requireRole(event, 'admin')` as
 * its first line, matching every handler under `server/api/admin/`.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: string; role?: string }>(event)
  const userId = body.userId
  const role = body.role?.toUpperCase()

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  if (!role || !ADDABLE_ROLES.includes(role as AddableRole)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Role must be one of: ${ADDABLE_ROLES.join(', ')}`,
    })
  }

  const result = await prisma.$transaction(async (tx) => {
    // Upsert the role itself: if the row already exists (e.g. re-adding
    // after a previous removal), this just recreates it.
    const updatedRole = await tx.user_Role.upsert({
      where: { userId_role: { userId, role: role as AddableRole } },
      update: { active: true },
      create: { userId, role: role as AddableRole, active: true },
    })

    // Granting VOLUNTEER also needs a Volunteer record to exist so the
    // "Volunteer Data" section has something to show/edit. gender/ethinicity
    // and the relation lists (languages, availabilities, etc.) are left as
    // their natural null/empty-array defaults. The string fields are set
    // to '' rather than left null, so text inputs render blank instead of
    // undefined.
    if (role === 'VOLUNTEER') {
      const blankStringFields = {
        otherVolunteerAreaDescription: '',
        otherCertificationDescription: '',
        emergencyContactName1: '',
        emergencyContactPhone1: '',
        emergencyContactName2: '',
        emergencyContactPhone2: '',
      }

      await tx.volunteer.upsert({
        where: { userId },
        update: {},
        create: { userId, ...blankStringFields },
      })
    }

    return updatedRole
  })

  return result
})