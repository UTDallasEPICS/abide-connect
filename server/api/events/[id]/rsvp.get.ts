import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * The full sign-up list for an event, split into volunteers and attendees.
 * Staff only — this returns names, phone numbers and email addresses.
 *
 * Every new sign-up is an account-holder `RSVP`, whose contact details are read
 * live off the linked `User`. `GuestRSVP` rows are still merged in because they
 * are real people holding real places, but they predate the removal of guest
 * sign-up and nothing creates more of them — hence no phone number on those.
 * `isGuest` preserves the distinction, and note the `id` field means different
 * things across the two: a `userId` for members, a `GuestRSVP.id` for guests —
 * so it is only unique within its own group.
 */
export default defineEventHandler(async (event) => {
  // Sign-up lists carry names, phones and emails, so they're staff-only.
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

  // Legacy rows only — guest sign-up was removed, so this list can shrink but
  // never grow.
  const guestRsvps = await prisma.guestRSVP.findMany({
    where: { eventId: id },
    orderBy: { createdAt: 'asc' },
  })

  const userRsvps = await prisma.rSVP.findMany({
    where: { eventId: id },
    include: { user: { select: { name: true, email: true, phone: true } } },
  })

  const rsvps = [
    ...userRsvps.map(r => ({
      id: r.userId,
      name: r.user?.name ?? '',
      email: r.user?.email ?? '',
      // Optional at sign-up, so it can legitimately be blank.
      phone: r.user?.phone ?? '',
      isVolunteer: r.isVolunteer,
      isGuest: false,
    })),
    ...guestRsvps.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: '',
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
