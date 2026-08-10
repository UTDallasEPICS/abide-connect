import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * The full sign-up list for an event, split into volunteers and attendees.
 * Staff only — this returns names and email addresses.
 *
 * Merges the two tables sign-ups can land in (`RSVP` for account holders,
 * `GuestRSVP` for anonymous ones) into a single list, since staff think in
 * terms of "who is coming" rather than how each person registered. `isGuest`
 * preserves the distinction, and note the `id` field means different things
 * across the two: a `userId` for members, a `GuestRSVP.id` for guests — so it
 * is only unique within its own group.
 */
export default defineEventHandler(async (event) => {
  // Sign-up lists carry names and emails, so they're staff-only.
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  const guestRsvps = await prisma.guestRSVP.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'asc' },
  })

  // Signed-in sign-ups live in a separate table, but staff want one list.
  const userRsvps = await prisma.rSVP.findMany({
    where: { eventId: id },
    include: { user: { select: { name: true, email: true } } },
  })

  const rsvps = [
    ...userRsvps.map(r => ({
      id: r.userId,
      name: r.user?.name ?? '',
      email: r.user?.email ?? '',
      isVolunteer: r.isVolunteer,
      isGuest: false,
    })),
    ...guestRsvps.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      isVolunteer: r.isVolunteer,
      isGuest: true,
    })),
  ]

  const volunteers = rsvps.filter(r => r.isVolunteer)
  const attendees = rsvps.filter(r => !r.isVolunteer)

  return {
    volunteerCount: volunteers.length,
    attendeeCount: attendees.length,
    volunteers,
    attendees,
  }
})
