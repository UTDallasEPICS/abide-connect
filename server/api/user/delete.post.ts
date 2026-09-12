import { readBody, defineEventHandler, createError } from 'h3'
import { requireRole } from '#server/utils/requireRole'

/**
 * Hard-deletes a user and everything hanging off them. Used by the admin
 * member-management screen.
 *
 * Admin only. The target is whatever `userId` the body names, so the
 * `requireRole` call below is the only thing standing between this route and
 * permanent deletion of any account — the global middleware is a no-op.
 * Compare `user/me.delete.ts`, which deletes only the caller's own account and
 * so needs a session but no role.
 *
 * Deletion is manual and ordered rather than relying on cascades: child rows go
 * first (hour logs, languages, availabilities, areas, certifications, RSVPs,
 * then the Volunteer), because the FKs are restrict-by-default and would
 * otherwise reject the parent delete. RSVPs are cleared twice on purpose —
 * once by `volunteerId` and once by `userId` — since a person can hold RSVPs
 * under either identity.
 *
 * The final `user.delete` sits outside the transaction, so a failure there
 * leaves the account stripped of its related records but still present.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody<{ userId?: string }>(event)
  const userId = body.userId
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { volunteer: true },
  })
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  await prisma.$transaction(async (tx) => {
    if (user.volunteer) {
      const volunteerId = user.volunteer.id

      await tx.volunteer_Hour_Log.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Language.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Availability.deleteMany({ where: { volunteerId } })
      await tx.volunteer_VolunteerArea.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Certification.deleteMany({ where: { volunteerId } })
      await tx.rSVP.deleteMany({ where: { volunteerId } })
      await tx.volunteer.delete({ where: { userId } })
    }

    await tx.user_Role.deleteMany({ where: { userId } })
    await tx.user_Notification.deleteMany({ where: { userId } })
    await tx.rSVP.deleteMany({ where: { userId } })
  })

  await prisma.user.delete({ where: { id: userId } })

  return { userId, deleted: true }
})
