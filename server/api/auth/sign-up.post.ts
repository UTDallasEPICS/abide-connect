import prisma from '#server/utils/prisma'
import type { Language, Availability } from '#server/utils/generated/prisma/client'
import { Prisma } from '#server/utils/generated/prisma/client'

export default defineEventHandler(async (event) => {
  try {
    const {
      name,
      email,
      phone,
      languages = [],
      gender,
      ethinicity,
      availability = [],
    } = await readBody(event)

    const selectedLanguages = languages as Language[]
    const selectedAvailability = availability as Availability[]

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: name as string | undefined,
          contactEmail: email as string,
          phone: phone as string | undefined,
        },
      })

      await tx.volunteer.create({
        data: {
          email: email as string,
          name: name as string | undefined,
          phone: phone as string | undefined,
          userId: createdUser.id,
          gender: gender.id,
          ethinicity: ethinicity.id,
          languages: {
            create: selectedLanguages.map(language => ({ language })),
          },
          availabilities: {
            create: selectedAvailability.map(time => ({ availability: time })),
          },
        },
      })
    })

    return { success: true }
  }
  catch (error: unknown) {
    console.error('[sign-up error]', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500
    const statusMessage =
      (error as { body?: { message?: string } }).body?.message
      ?? (error as { message?: string }).message
      ?? 'An unexpected error occurred'

    throw createError({ statusCode, statusMessage })
  }
})
