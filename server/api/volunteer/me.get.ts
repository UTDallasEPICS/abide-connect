import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * The signed-in user's volunteer record, with the join-table selections
 * flattened into plain enum arrays so the settings form can bind to them
 * directly. Returns null when the user hasn't applied to volunteer.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.user) {
    return null
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session.user.id },
    include: {
      languages: true,
      availabilities: true,
      volunteerAreas: true,
      certifications: true,
    },
  })

  if (!volunteer) return null

  return {
    id: volunteer.id,
    approvalStatus: volunteer.approvalStatus,
    gender: volunteer.gender,
    ethinicity: volunteer.ethinicity,
    // `availability` (singular) matches the application form's field name.
    languages: volunteer.languages.map(l => l.language),
    availability: volunteer.availabilities.map(a => a.availability),
    volunteerAreas: volunteer.volunteerAreas.map(v => v.volunteerArea),
    certifications: volunteer.certifications.map(c => c.certification),
    otherVolunteerAreaDescription: volunteer.otherVolunteerAreaDescription,
    otherCertificationDescription: volunteer.otherCertificationDescription,
    emergencyContactName1: volunteer.emergencyContactName1,
    emergencyContactPhone1: volunteer.emergencyContactPhone1,
    emergencyContactName2: volunteer.emergencyContactName2,
    emergencyContactPhone2: volunteer.emergencyContactPhone2,
  }
})
