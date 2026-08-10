import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import { sendSignupConfirmation } from '#server/utils/eventMailer'
import {
  canRegisterAsAttendee,
  canSignUpAsVolunteer,
  canViewEvent,
  eventTypeFromFlags,
} from '#shared/utils/eventType'

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

    // Confirmation is a courtesy, not part of the sign-up: SMTP can take
    // seconds and a bounced address must not fail the RSVP, so it's dispatched
    // without blocking the response and swallows its own errors.
    const sessionUser = event.context.session?.user
    if (sessionUser?.email) {
      void sendSignupConfirmation({
        eventId: id,
        email: sessionUser.email,
        name: sessionUser.name ?? null,
        isVolunteer,
        claim: { type: 'user', userId: viewer.userId, eventId: id },
      }).catch(error => console.error('[rsvp] confirmation email failed', error))
    }

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

  // For a guest this email matters more than it does for an account holder:
  // it's their only record of the sign-up, and the cancel link inside it is
  // the only way they can withdraw without ringing the office.
  void sendSignupConfirmation({
    eventId: id,
    email: rsvp.email,
    name: rsvp.name,
    isVolunteer,
    claim: { type: 'guest', guestRsvpId: rsvp.id },
  }).catch(error => console.error('[rsvp] guest confirmation email failed', error))

  setResponseStatus(event, 201)
  return rsvp
})
