import {
  detailCard,
  escapeHtml,
  escapeHtmlMultiline,
  link,
  paragraph,
  primaryButton,
  renderEmailShell,
  secondaryButton,
  strong,
} from './email-theme'
import type { DetailRow } from './email-theme'
import { mapUrls } from './eventTime'

/**
 * The two emails we send someone about an event they signed up for: the
 * confirmation, straight after they sign up, and the reminder, 24 hours before
 * it starts.
 *
 * They share a shape on purpose — same facts, same tinted detail card, same
 * pair of buttons — so the reminder reads as a follow-up to the confirmation
 * rather than as a different system writing in. Both are built from
 * `email-theme.ts` and both carry a plain-text twin, which mail clients in text
 * mode need and spam filters like to see.
 */

export interface EventEmail {
  subject: string
  text: string
  html: string
}

export interface EventEmailInput {
  /** Recipient's display name, if we have one. */
  name: string | null
  eventTitle: string
  /** Event blurb, plain text. Long descriptions are trimmed for the email. */
  description?: string | null
  /** Already formatted for display, e.g. "Tuesday, March 4 at 9:00 AM – 12:00 PM". */
  when: string
  location: string | null
  /** Absolute link back to the event page. */
  eventUrl: string
  /**
   * Absolute link to the one-click cancel page. Optional because it's built
   * from a signed token, and an app with no signing secret configured should
   * still send the email — just without the button.
   */
  cancelUrl?: string | null
  /** Absolute "add to Google Calendar" link, shown only on the confirmation. */
  calendarUrl?: string | null
  /** True when they signed up to volunteer rather than to attend. */
  isVolunteer: boolean
  /**
   * Which kind of recipient this is. It changes the footer — an account holder
   * manages email in /settings and a guest can't, so the guest wording explains
   * why they got it and leans on the cancel link instead.
   */
  audience: 'user' | 'guest'
}

/** Descriptions are free text and some are essays; emails get the opening. */
const DESCRIPTION_LIMIT = 400

function trimDescription(description: string | null | undefined): string | null {
  const text = description?.trim()
  if (!text) return null
  if (text.length <= DESCRIPTION_LIMIT) return text
  // Cut on a word boundary so the ellipsis doesn't land mid-word.
  const clipped = text.slice(0, DESCRIPTION_LIMIT)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > DESCRIPTION_LIMIT * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

/**
 * Footer small print. Guests can't turn anything off in a settings page they've
 * never seen, so theirs says what this email is and isn't.
 */
function footNote(audience: 'user' | 'guest', hasCancelUrl: boolean): string {
  if (audience === 'guest') {
    return hasCancelUrl
      ? 'You\'re receiving this because you signed up for this event with this email address. It\'s about this event only — you haven\'t been added to any mailing list. Use the link above to cancel your spot at any time.'
      : 'You\'re receiving this because you signed up for this event with this email address. It\'s about this event only — you haven\'t been added to any mailing list.'
  }
  return 'You\'re receiving this because you signed up for this event in Abide Connect. You can manage your email preferences in Settings.'
}

/**
 * The "Where" row: the address itself opens a pin in maps, and the line under
 * it hands off to whichever app the reader actually navigates with — the point
 * being that nobody has to retype an address into their phone on the morning of
 * the event.
 */
function whereRow(address: string): DetailRow {
  const maps = mapUrls(address)
  if (!maps) return { label: 'Where', value: escapeHtml(address) }

  return {
    label: 'Where',
    value: link(maps.place, escapeHtml(address)),
    note: `Get directions: ${link(maps.appleDirections, 'Apple Maps')} &middot; ${link(maps.googleDirections, 'Google Maps')}`,
  }
}

/** The same address and directions, for the plain-text twin. */
function textLocationLines(location: string | null): string[] {
  if (!location) return []

  const maps = mapUrls(location)
  return [
    `Where: ${location}`,
    ...(maps
      ? [
          `Directions (Apple Maps): ${maps.appleDirections}`,
          `Directions (Google Maps): ${maps.googleDirections}`,
        ]
      : []),
  ]
}

/** Shared closing lines for the plain-text twin. */
function textLinks(input: EventEmailInput): string[] {
  const lines = [`Event details: ${input.eventUrl}`]
  if (input.calendarUrl) lines.push(`Add to your calendar: ${input.calendarUrl}`)
  if (input.cancelUrl) lines.push(`Can't make it? Cancel your sign-up: ${input.cancelUrl}`)
  return lines
}

/** The tinted facts panel both emails carry. */
function eventDetails(input: EventEmailInput): string {
  return detailCard([
    { label: 'Event', value: escapeHtml(input.eventTitle) },
    { label: 'When', value: escapeHtml(input.when) },
    input.location ? whereRow(input.location) : null,
    {
      label: 'Your spot',
      value: input.isVolunteer ? 'Volunteering' : 'Attending',
    },
  ])
}

/**
 * Sent immediately after someone signs up for an event, to both account holders
 * and guests.
 *
 * This one is transactional — it's the receipt for something the recipient just
 * did, and for a guest it's the only record of the sign-up they have — so it
 * goes out regardless of the reminder preferences that gate
 * `buildEventReminderEmail`.
 */
export function buildEventSignupEmail(input: EventEmailInput): EventEmail {
  const { name, eventTitle, when, location, eventUrl, cancelUrl, calendarUrl, isVolunteer, audience } = input

  const greeting = name ? `Hi ${name},` : 'Hi,'
  const role = isVolunteer ? 'volunteering at' : 'attending'
  const description = trimDescription(input.description)

  const text = [
    greeting,
    '',
    isVolunteer
      ? `Thanks for volunteering — you're on the list for ${eventTitle}.`
      : `You're signed up for ${eventTitle}. We're glad you're coming.`,
    '',
    `Event: ${eventTitle}`,
    `When: ${when}`,
    ...textLocationLines(location),
    `Your spot: ${isVolunteer ? 'Volunteering' : 'Attending'}`,
    ...(description ? ['', description] : []),
    '',
    ...textLinks(input),
    '',
    'If your plans change, please cancel your sign-up so we can plan accordingly.',
    '',
    footNote(audience, Boolean(cancelUrl)),
  ].join('\n')

  return {
    subject: `You're signed up: ${eventTitle}`,
    text,
    html: renderEmailShell({
      title: `You're signed up for ${eventTitle}`,
      preheader: `${eventTitle} — ${when}`,
      heading: isVolunteer ? 'You\'re on the volunteer list' : 'You\'re signed up',
      blocks: [
        paragraph(
          `${escapeHtml(greeting)} thanks for signing up — you're ${role} ${strong(escapeHtml(eventTitle))}. Here's everything you need.`,
        ),
        eventDetails(input),
        ...(description
          ? [paragraph(escapeHtmlMultiline(description), { size: 14, top: 20 })]
          : []),
        primaryButton(eventUrl, 'View event details'),
        ...(calendarUrl ? [secondaryButton(calendarUrl, 'Add to your calendar')] : []),
        ...(cancelUrl ? [secondaryButton(cancelUrl, 'Can\'t make it? Cancel my spot')] : []),
        paragraph(
          'If your plans change, please cancel your sign-up so we can plan for the right numbers.',
          { align: 'center', size: 13, top: 20 },
        ),
      ],
      footNote: footNote(audience, Boolean(cancelUrl)),
    }),
  }
}

/**
 * The 24-hour reminder, sent by the `eventReminders` cron job to account
 * holders who opted in (`User.emailRemindersEnabled`) and — when
 * `GUEST_EVENT_REMINDER_EMAILS` is on — to guests.
 *
 * Shorter than the confirmation by design: the recipient has already read the
 * details once, so this is the date, the address and a way out.
 */
export function buildEventReminderEmail(input: EventEmailInput): EventEmail {
  const { name, eventTitle, when, location, eventUrl, cancelUrl, isVolunteer, audience } = input

  const greeting = name ? `Hi ${name},` : 'Hi,'
  const role = isVolunteer ? 'volunteering at' : 'attending'

  const text = [
    greeting,
    '',
    `This is a reminder that you're ${role} ${eventTitle} tomorrow.`,
    '',
    `When: ${when}`,
    ...textLocationLines(location),
    '',
    ...textLinks(input),
    '',
    'If your plans have changed, please cancel your sign-up so we can plan accordingly.',
    '',
    footNote(audience, Boolean(cancelUrl)),
  ].join('\n')

  return {
    subject: `Reminder: ${eventTitle} is tomorrow`,
    text,
    html: renderEmailShell({
      title: `${eventTitle} is tomorrow`,
      preheader: `${eventTitle} — ${when}`,
      heading: 'See you tomorrow',
      blocks: [
        paragraph(
          `${escapeHtml(greeting)} this is a reminder that you're ${role} ${strong(escapeHtml(eventTitle))} tomorrow.`,
        ),
        eventDetails(input),
        primaryButton(eventUrl, 'View event details'),
        ...(cancelUrl ? [secondaryButton(cancelUrl, 'Can\'t make it? Cancel my spot')] : []),
        paragraph(
          'If your plans have changed, please cancel your sign-up so we can plan accordingly.',
          { align: 'center', size: 13, top: 20 },
        ),
      ],
      footNote: footNote(audience, Boolean(cancelUrl)),
    }),
  }
}
