import prisma from '#server/utils/prisma'
import { getEventViewer } from '#server/utils/eventViewer'
import { sendSignupConfirmation } from '#server/utils/eventMailer'
import {
  canRegisterAsAttendee,
  canSignUpAsVolunteer,
  canViewEvent,
  eventTypeFromFlags,
} from '#shared/utils/eventType'

/**
 * Signs the current user up for an event, as either an attendee or a volunteer.
 *
 * An account is required for both. There is deliberately no guest path: the
 * sign-up carries the person's name, phone and email by pointing at their
 * `User` row rather than copying contact details out of the request body, so
 * staff always have a real, verified address to reach an attendee on. Anonymous
 * callers get a 401 telling them to sign in or register.
 *
 * The row is keyed on (userId, eventId) and upserted, so re-submitting switches
 * attendee↔volunteer rather than erroring. It links to the `Volunteer` row when
 * one exists, which is what lets staff approve pending volunteers who turned up
 * to a training event.
 *
 * The visibility check runs before the auth check, and a viewer who can't see
 * the event gets a 404 rather than a 403 or 401, so this can't be used to probe
 * for the existence of volunteer-only or training events.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  const viewer = await getEventViewer(event)

  const foundEvent = await prisma.event.findUnique({
    where: { id },
  })

  // Same 404 for a hidden event as for a missing one.
  if (!foundEvent || !canViewEvent(foundEvent, viewer)) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  if (!viewer.userId) {
    throw createError({
      statusCode: 401,
      message: 'Please sign in or create an account to sign up for this event',
    })
  }

  const isVolunteer = body?.isVolunteer ?? false
  const eventType = eventTypeFromFlags(foundEvent)

  // Volunteering additionally needs a volunteer profile in the right approval
  // state — but for those people it needs no staff approval.
  if (isVolunteer) {
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
})
