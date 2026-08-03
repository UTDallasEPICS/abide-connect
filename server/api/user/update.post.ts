import { readBody, defineEventHandler, createError } from 'h3'

type UpdateUserBody = {
  userId?: string
  phoneNumber?: string | null
  adminNote?: string | null
  isActive?: boolean

  gender?: string | null
  ethinicity?: string | null
  languages?: string[]
  availabilities?: string[]
  volunteerAreas?: string[]
  certifications?: string[]
  otherVolunteerArea?: string | null
  otherCertification?: string | null

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
  const ethinicity = normalizeNullable(body.ethinicity)

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
        adminNote: normalizeNullable(body.adminNote),
      },
    })

    let updatedVolunteer = null

    if (user.volunteer) {
      const volunteerId = user.volunteer.id

      updatedVolunteer = await tx.volunteer.update({
        where: { userId },
        data: {
          gender: gender as any,
          ethinicity: ethinicity as any,
          otherVolunteerAreaDescription: normalizeNullable(body.otherVolunteerArea),
          otherCertificationDescription: normalizeNullable(body.otherCertification),
          emergencyContactName1: normalizeNullable(body.emergencyContactName1),
          emergencyContactPhone1: normalizeNullable(body.emergencyContactPhone1),
          emergencyContactName2: normalizeNullable(body.emergencyContactName2),
          emergencyContactPhone2: normalizeNullable(body.emergencyContactPhone2),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      })

      // Multi-select relations: replace the full set on every save.
      // Rename these model/field names to match your actual schema
      // (VolunteerLanguage/language, VolunteerAvailability/availability, etc.)
      if (body.languages) {
        await tx.volunteer_Language.deleteMany({ where: { volunteerId } })
        if (body.languages.length) {
          await tx.volunteer_Language.createMany({
            data: body.languages.map((language) => ({ volunteerId, language: language as any })),
          })
        }
      }

      if (body.availabilities) {
        await tx.volunteer_Availability.deleteMany({ where: { volunteerId } })
        if (body.availabilities.length) {
          await tx.volunteer_Availability.createMany({
            data: body.availabilities.map((availability) => ({ volunteerId, availability: availability as any })),
          })
        }
      }

      if (body.volunteerAreas) {
        await tx.volunteer_VolunteerArea.deleteMany({ where: { volunteerId } })
        if (body.volunteerAreas.length) {
          await tx.volunteer_VolunteerArea.createMany({
            data: body.volunteerAreas.map((volunteerArea) => ({ volunteerId, volunteerArea: volunteerArea as any })),
          })
        }
      }

      if (body.certifications) {
        await tx.volunteer_Certification.deleteMany({ where: { volunteerId } })
        if (body.certifications.length) {
          await tx.volunteer_Certification.createMany({
            data: body.certifications.map((certification) => ({ volunteerId, certification: certification as any })),
          })
        }
      }
    }

    return { user: updatedUser, volunteer: updatedVolunteer }
  })

  return result
})