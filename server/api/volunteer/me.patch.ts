import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { Gender, Ethinicity, Language, Availability, VolunteerArea, Certification } from '#server/utils/generated/prisma/enums'

/**
 * Lets a volunteer revise their own application from /settings.
 *
 * Two deliberate limits:
 *  - The step-3 legal acknowledgements (code of conduct, NDA, handbook,
 *    background check consent, …) are not editable. They record what was agreed
 *    to at submission time, so they're captured once by the application flow
 *    and never rewritten here.
 *  - `approvalStatus` is untouched, so fixing a phone number doesn't cost an
 *    approved volunteer their access. Only admins move that, via
 *    /api/volunteer/[id]/approval.
 *
 * The enum join tables have no updatable payload beyond their own key, so each
 * selection set is replaced wholesale (delete + recreate) inside the
 * transaction rather than diffed.
 */

/** Keeps only values that are real members of the given Prisma enum. */
function sanitizeEnumList<T extends Record<string, string>>(
  value: unknown,
  enumObject: T,
  field: string,
): T[keyof T][] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be a list` })
  }

  const allowed = Object.values(enumObject) as string[]
  const invalid = value.filter(v => typeof v !== 'string' || !allowed.includes(v))
  if (invalid.length > 0) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${field}: ${invalid.join(', ')}` })
  }

  // Dedupe — the join tables are keyed on [volunteerId, value], so a repeated
  // selection would blow up the createMany.
  return [...new Set(value)] as T[keyof T][]
}

function sanitizeEnum<T extends Record<string, string>>(
  value: unknown,
  enumObject: T,
  field: string,
): T[keyof T] | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || !(Object.values(enumObject) as string[]).includes(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${field}` })
  }
  return value as T[keyof T]
}

/** Trims a free-text field, mapping blank to null so we don't store "". */
function sanitizeText(value: unknown, field: string, maxLength = 500): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, statusMessage: `${field} must be text` })
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be ${maxLength} characters or fewer` })
  }
  return trimmed.length === 0 ? null : trimmed
}

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!volunteer) {
    throw createError({ statusCode: 404, statusMessage: 'No volunteer application found for this account' })
  }

  const body = await readBody(event)

  const languages = sanitizeEnumList(body.languages, Language, 'languages')
  const availability = sanitizeEnumList(body.availability, Availability, 'availability')
  const volunteerAreas = sanitizeEnumList(body.volunteerAreas, VolunteerArea, 'volunteerAreas')
  const certifications = sanitizeEnumList(body.certifications, Certification, 'certifications')

  const scalarData = {
    gender: sanitizeEnum(body.gender, Gender, 'gender'),
    ethinicity: sanitizeEnum(body.ethinicity, Ethinicity, 'ethinicity'),
    otherVolunteerAreaDescription: sanitizeText(body.otherVolunteerAreaDescription, 'Other volunteer area description'),
    otherCertificationDescription: sanitizeText(body.otherCertificationDescription, 'Other certification description'),
    emergencyContactName1: sanitizeText(body.emergencyContactName1, 'Primary emergency contact name', 100),
    emergencyContactPhone1: sanitizeText(body.emergencyContactPhone1, 'Primary emergency contact phone', 30),
    emergencyContactName2: sanitizeText(body.emergencyContactName2, 'Secondary emergency contact name', 100),
    emergencyContactPhone2: sanitizeText(body.emergencyContactPhone2, 'Secondary emergency contact phone', 30),
  }

  // The primary emergency contact is required on the application, so don't let
  // an edit blank it out.
  if ('emergencyContactName1' in body && !scalarData.emergencyContactName1) {
    throw createError({ statusCode: 400, statusMessage: 'A primary emergency contact name is required' })
  }
  if ('emergencyContactPhone1' in body && !scalarData.emergencyContactPhone1) {
    throw createError({ statusCode: 400, statusMessage: 'A primary emergency contact phone number is required' })
  }

  const volunteerId = volunteer.id

  await prisma.$transaction(async (tx) => {
    await tx.volunteer.update({ where: { id: volunteerId }, data: scalarData })

    if (languages) {
      await tx.volunteer_Language.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Language.createMany({
        data: languages.map(language => ({ volunteerId, language })),
      })
    }

    if (availability) {
      await tx.volunteer_Availability.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Availability.createMany({
        data: availability.map(a => ({ volunteerId, availability: a })),
      })
    }

    if (volunteerAreas) {
      await tx.volunteer_VolunteerArea.deleteMany({ where: { volunteerId } })
      await tx.volunteer_VolunteerArea.createMany({
        data: volunteerAreas.map(volunteerArea => ({ volunteerId, volunteerArea })),
      })
    }

    if (certifications) {
      await tx.volunteer_Certification.deleteMany({ where: { volunteerId } })
      await tx.volunteer_Certification.createMany({
        data: certifications.map(certification => ({ volunteerId, certification })),
      })
    }
  })

  return { success: true }
})
