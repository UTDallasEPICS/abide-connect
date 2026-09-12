import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import type { Gender, Ethinicity, Language, Availability, VolunteerArea, Certification } from '#server/utils/generated/prisma/client'
import { Prisma } from '#server/utils/generated/prisma/client'

/**
 * Submits a volunteer application for the signed-in user, creating the
 * `Volunteer` record and granting the VOLUNTEER role.
 *
 * The role grant and the profile creation share a transaction because they must
 * not diverge: a role without a profile breaks every `findUnique({ userId })`
 * lookup downstream, and a profile without the role leaves the volunteer unable
 * to reach the pages it unlocks.
 *
 * `approvalStatus` is left at its schema default (PENDING) — applying does not
 * grant access. Volunteers become APPROVED by attending a training event and
 * being approved by staff (`volunteer/[id]/approval.patch.ts`).
 *
 * A second application from the same account hits the unique constraint on
 * `userId` and is reported as a 409 rather than a 500.
 *
 * Unlike `me.patch.ts`, the enum values here are cast rather than validated, so
 * a malformed payload fails at the database instead of as a 400.
 */
export default defineEventHandler(async (event) => {
  try {
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session?.user) {
      throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
    }
    const userId = session.user.id

    const {
      gender,
      ethinicity,
      languages,
      // The form field is `availability` (singular); accept the plural too so
      // any older client payload still applies.
      availability,
      availabilities,
      volunteerAreas,
      certifications,
      otherVolunteerAreaDescription,
      otherCertificationDescription,
      emergencyContactName1,
      emergencyContactPhone1,
      emergencyContactName2,
      emergencyContactPhone2,
    } = await readBody(event)

    const volunteer = await prisma.$transaction(async (tx) => {
      await tx.user_Role.create({
        data: { userId, role: 'VOLUNTEER', active: true },
      })

      return tx.volunteer.create({
        data: {
          userId,
          gender: gender as Gender | undefined,
          ethinicity: ethinicity as Ethinicity | undefined,
          otherVolunteerAreaDescription: otherVolunteerAreaDescription as string | undefined,
          otherCertificationDescription: otherCertificationDescription as string | undefined,
          emergencyContactName1: emergencyContactName1 as string | undefined,
          emergencyContactPhone1: emergencyContactPhone1 as string | undefined,
          emergencyContactName2: emergencyContactName2 as string | undefined,
          emergencyContactPhone2: emergencyContactPhone2 as string | undefined,
          languages: {
            create: ((languages ?? []) as Language[]).map(language => ({ language })),
          },
          availabilities: {
            create: ((availability ?? availabilities ?? []) as Availability[]).map(a => ({ availability: a })),
          },
          volunteerAreas: {
            create: ((volunteerAreas ?? []) as VolunteerArea[]).map(volunteerArea => ({ volunteerArea })),
          },
          certifications: {
            create: ((certifications ?? []) as Certification[]).map(certification => ({ certification })),
          },
        },
      })
    })

    return { success: true, volunteer }
  }
  catch (error: unknown) {
    console.error('[volunteer-application error]', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'A volunteer profile already exists for this account' })
    }
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const statusMessage
      = (error as { body?: { message?: string } }).body?.message
        ?? (error as { statusMessage?: string }).statusMessage
        ?? (error as { message?: string }).message
        ?? 'An unexpected error occurred'
    throw createError({ statusCode, statusMessage })
  }
})
