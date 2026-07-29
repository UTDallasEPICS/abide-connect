import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
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
