import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import {
  canRegisterAsAttendee,
  canSignUpAsVolunteer,
  canViewEvent,
  eventTypeFromFlags,
} from '#shared/utils/eventType'

/**
 * Signs someone up for an event, as either an attendee or a volunteer.
 *
 * Deliberately open to anonymous callers — the public can RSVP to public events
 * without an account. Which of the two storage paths is taken depends on
 * whether there's a session, and they are genuinely different records:
 *
 *   - Signed in  → `RSVP`, keyed on (userId, eventId) and upserted, so
 *                  re-submitting switches attendee↔volunteer rather than
 *                  erroring. Links to the `Volunteer` row when one exists,
 *                  which is what lets staff approve pending volunteers who
 *                  turned up to a training event.
 *   - Anonymous  → `GuestRSVP`, name + email only, with a manual duplicate
 *                  check standing in for the unique constraint the table
 *                  doesn't have. That check is racy under concurrent submits.
 *
 * A viewer who can't see the event gets a 404 rather than a 403, so this can't
 * be used to probe for the existence of volunteer-only or training events.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  const isVolunteer = body.isVolunteer ?? false
  const eventType = eventTypeFromFlags(foundEvent)
  const viewer = await getEventViewer(event)

  if (!canViewEvent(foundEvent, viewer)) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // Volunteering is only ever open to people with a volunteer profile, so it
  // can't be done as a guest — but for those people it needs no approval.
  if (isVolunteer) {
    if (!viewer.userId) {
      throw createError({
        statusCode: 401,
        message: 'Please sign in to your volunteer account to sign up for this event',
      })
    }

    if (!canSignUpAsVolunteer(eventType, viewer)) {
      throw createError({
        statusCode: 403,
        message: eventType === 'TRAINING'
          ? 'Only volunteers awaiting approval can sign up for training events'
          : 'You must be an approved volunteer to sign up for this event',
      })
    }
  }
  else if (!canRegisterAsAttendee(eventType)) {
    throw createError({
      statusCode: 400,
      message: 'This event is not accepting attendee registrations',
    })
  }

  // Logged-in users get a real RSVP linked to their account (and volunteer
  // profile, if any). This is what lets staff approve pending volunteers who
  // attended a training event.
  if (viewer.userId) {
    const volunteer = await prisma.volunteer.findUnique({
      where: { userId: viewer.userId },
      select: { id: true },
    })

    const rsvp = await prisma.rSVP.upsert({
      where: { userId_eventId: { userId: viewer.userId, eventId: id } },
      update: { isVolunteer, volunteerId: volunteer?.id ?? null },
      create: {
        userId: viewer.userId,
        eventId: id,
        isVolunteer,
        volunteerId: volunteer?.id ?? null,
      },
    })

    setResponseStatus(event, 201)
    return rsvp
  }

  // Anonymous visitors sign up as guests.
  if (!body.name || !body.email) {
    throw createError({ statusCode: 400, message: 'Name and email are required' })
  }

  const existing = await prisma.guestRSVP.findFirst({
    where: {
      eventId: id,
      email: body.email.toLowerCase(),
      isVolunteer,
    },
  })

  if (existing) {
    throw createError({ statusCode: 409, message: 'You are already signed up for this event' })
  }

  const rsvp = await prisma.guestRSVP.create({
    data: {
      eventId: id,
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      isVolunteer,
    },
  })

  setResponseStatus(event, 201)
  return rsvp
})
