import { readBody, defineEventHandler, createError } from 'h3'


type UpdateUserBody = {
  userId?: string
  phoneNumber?: string | null
  gender?: string | null
  ethinicity?: string | null
  emergencyContactName1?: string | null
  emergencyContactPhone1?: string | null
  emergencyContactName2?: string | null
  emergencyContactPhone2?: string | null
}

// Treats '' and undefined as "clear the field" (null), everything else passes through as-is.
function normalizeNullable(value: string | null | undefined) {
  if (value === undefined || value === '') return null
  return value
}

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateUserBody>(event)
  const userId = body.userId

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  const gender = normalizeNullable(body.gender)
  if (gender !== null) {
    throw createError({ statusCode: 400, statusMessage: `Invalid  gender.` })
  }

  const ethinicity = normalizeNullable(body.ethinicity)
  if (ethinicity !== null) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ethnicity.` })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { volunteer: true },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        phone: normalizeNullable(body.phoneNumber),
      },
    })

    // Gender / ethnicity / emergency contacts all live on Volunteer.
    // Only touch it if the user actually has a volunteer record —
    // these fields aren't editable in the UI otherwise.
    let updatedVolunteer = null
    if (user.volunteer) {
      updatedVolunteer = await tx.volunteer.update({
        where: { userId },
        data: {
          gender: gender as any,
          ethinicity: ethinicity as any,
          emergencyContactName1: normalizeNullable(body.emergencyContactName1),
          emergencyContactPhone1: normalizeNullable(body.emergencyContactPhone1),
          emergencyContactName2: normalizeNullable(body.emergencyContactName2),
          emergencyContactPhone2: normalizeNullable(body.emergencyContactPhone2),
        },
      })
    }

    return { user: updatedUser, volunteer: updatedVolunteer }
  })

  return result
})