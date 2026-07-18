import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import type { Gender, Ethinicity, Language, Availability, VolunteerArea, Certification } from '#server/utils/generated/prisma/client'
import { Prisma } from '#server/utils/generated/prisma/client'

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
            create: ((availabilities ?? []) as Availability[]).map(availability => ({ availability })),
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
    const statusMessage =
      (error as { body?: { message?: string } }).body?.message
      ?? (error as { statusMessage?: string }).statusMessage
      ?? (error as { message?: string }).message
      ?? 'An unexpected error occurred'
    throw createError({ statusCode, statusMessage })
  }
})