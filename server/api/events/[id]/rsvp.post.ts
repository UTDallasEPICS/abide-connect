import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

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

  // Logged-in users get a real RSVP linked to their account (and volunteer
  // profile, if any). This is what lets staff approve pending volunteers who
  // attended a training event.
  const session = await auth.api.getSession({ headers: event.headers })
  if (session?.user) {
    const volunteer = await prisma.volunteer.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })

    const rsvp = await prisma.rSVP.upsert({
      where: { userId_eventId: { userId: session.user.id, eventId: id } },
      update: { isVolunteer, volunteerId: volunteer?.id ?? null },
      create: {
        userId: session.user.id,
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
