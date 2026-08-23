import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Permanently deletes the signed-in user's account and everything hanging off
 * it. Irreversible — the client is expected to confirm before calling.
 *
 * Most relations in the schema have no `onDelete: Cascade`, so dependants are
 * removed explicitly, deepest first, inside a transaction. Session/Account
 * (better-auth) and PushSubscription do cascade, but sessions are cleared
 * up front anyway so the account can't keep being used mid-delete.
 *
 * Volunteer_Hour_Log rows go with the account. They're per-volunteer records
 * rather than an aggregate Abide reports on, and leaving orphaned rows behind
 * would break the volunteerId foreign key.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const userId = session.user.id

  await prisma.$transaction(async (tx) => {
    const volunteer = await tx.volunteer.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (volunteer) {
      const volunteerId = volunteer.id
      await tx.volunteer_Language.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Availability.deleteMany({ where: { volunteerId } })
      await tx.volunteer_VolunteerArea.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Certification.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Hour_Log.deleteMany({ where: { volunteerId } })
      // RSVPs are keyed on userId, but an RSVP can also point at the volunteer
      // record, so clear both angles before the volunteer row goes.
      await tx.rSVP.deleteMany({ where: { volunteerId } })
    }

    await tx.rSVP.deleteMany({ where: { userId } })
    await tx.user_Notification.deleteMany({ where: { userId } })
    await tx.user_Role.deleteMany({ where: { userId } })
    await tx.pushSubscription.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })

    if (volunteer) {
      await tx.volunteer.delete({ where: { id: volunteer.id } })
    }

    await tx.user.delete({ where: { id: userId } })
  })

  return { success: true }
})
