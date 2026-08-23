import prisma from './prisma'
import { transporter } from './auth'
import { buildEventSignupEmail } from './event-email'
import type { EventEmail, EventEmailInput } from './event-email'
import { addToCalendarUrl, appUrl, formatEventWhen } from './eventTime'
import { rsvpCancelPath, signRsvpCancelToken } from './rsvpCancelToken'
import type { RsvpCancelClaim } from './rsvpCancelToken'

/**
 * Delivery side of the event emails: turning an `Event` row into the shape
 * `event-email.ts` renders, and putting it on the wire.
 *
 * Every send here is best-effort, matching the calendar and push layers — a
 * bounced address or a dead SMTP host must not fail the RSVP that triggered it.
 */

/**
 * Absolute cancel-my-spot link for one sign-up, or null when the app has no
 * signing secret to mint one with (dev setups, mostly). The emails simply drop
 * the button in that case.
 */
export function cancelUrlFor(claim: RsvpCancelClaim): string | null {
  try {
    return appUrl(rsvpCancelPath(signRsvpCancelToken(claim)))
  }
  catch (error) {
    console.warn('[event-email] cancel link unavailable', error)
    return null
  }
}

/** Event fields the emails need. Use `eventEmailSelect` to load them. */
export interface MailableEvent {
  id: string
  title: string
  shortDesc: string | null
  description: string | null
  startTime: Date
  endTime: Date
  location: { address: string } | null
}

/** Prisma `select` matching `MailableEvent`. */
export const eventEmailSelect = {
  id: true,
  title: true,
  shortDesc: true,
  description: true,
  startTime: true,
  endTime: true,
  location: { select: { address: true } },
} as const

/**
 * Assembles the recipient-independent half of an email — dates, address, links
 * — so the confirmation and the reminder describe the same event identically.
 */
export function eventEmailDetails(event: MailableEvent): Pick<EventEmailInput, 'eventTitle' | 'description' | 'when' | 'location' | 'eventUrl' | 'calendarUrl'> {
  const address = event.location?.address ?? null
  // Prefer the blurb written for listings; fall back to the long description.
  const description = event.shortDesc?.trim() || event.description?.trim() || null

  return {
    eventTitle: event.title,
    description,
    when: formatEventWhen(event.startTime, event.endTime),
    location: address,
    eventUrl: appUrl(`/events/${event.id}`),
    calendarUrl: addToCalendarUrl({
      title: event.title,
      description: description ?? undefined,
      startTime: event.startTime,
      endTime: event.endTime,
      location: address,
    }),
  }
}

/**
 * Sends one event email. Returns whether it went out.
 *
 * Transport errors are logged, not thrown: callers are either mid-RSVP (where
 * the sign-up is what matters) or mid-cron run (where one bad address must not
 * stop everyone else's reminder).
 */
export async function sendEventEmail(to: string, mail: EventEmail): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
    return true
  }
  catch (error) {
    console.error('[event-email] send failed for', to, error)
    return false
  }
}

/**
 * Confirms a sign-up to the person who just made it.
 *
 * Loads the event itself so callers only have to hand over ids. Fire-and-forget
 * is the intended usage — see the note in `events/[id]/rsvp.post.ts` — so this
 * resolves to a boolean rather than throwing on a bad address.
 */
export async function sendSignupConfirmation(params: {
  eventId: string
  /** Where to send it. */
  email: string
  /** Recipient's display name, if known. */
  name: string | null
  isVolunteer: boolean
  /** Identifies the sign-up, so the email can carry a cancel link for it. */
  claim: RsvpCancelClaim
}): Promise<boolean> {
  const { eventId, email, name, isVolunteer, claim } = params

  if (!email) return false

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: eventEmailSelect,
  })

  if (!event) return false

  const mail = buildEventSignupEmail({
    ...eventEmailDetails(event),
    name,
    isVolunteer,
    audience: claim.type === 'guest' ? 'guest' : 'user',
    cancelUrl: cancelUrlFor(claim),
  })

  return sendEventEmail(email, mail)
}
