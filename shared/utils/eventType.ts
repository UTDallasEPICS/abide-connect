/**
 * An event's audience, expressed as a single exclusive choice.
 *
 * The database still stores the three boolean columns
 * (`allowVolunteers` / `allowAttendees` / `isTraining`), but nothing outside
 * this module should set them by hand — an event must be exactly one of these
 * four kinds, so a training session can never also be an attendee event.
 */
export const EVENT_TYPES = [
  'VOLUNTEERS_AND_ATTENDEES',
  'VOLUNTEERS',
  'ATTENDEES',
  'TRAINING',
] as const

export type EventType = typeof EVENT_TYPES[number]

export interface EventAudienceFlags {
  allowVolunteers: boolean
  allowAttendees: boolean
  isTraining: boolean
}

export const EVENT_TYPE_OPTIONS: {
  value: EventType
  label: string
  description: string
  icon: string
}[] = [
  {
    value: 'VOLUNTEERS_AND_ATTENDEES',
    label: 'Allow Volunteers and Attendees',
    description: 'Open to the public; approved volunteers can also sign up to help.',
    icon: 'i-lucide-users',
  },
  {
    value: 'VOLUNTEERS',
    label: 'Allow Volunteers',
    description: 'Only visible to approved volunteers, who sign up with one tap.',
    icon: 'i-lucide-heart-handshake',
  },
  {
    value: 'ATTENDEES',
    label: 'Allow Attendees',
    description: 'Open to the public for attendee registration only.',
    icon: 'i-lucide-ticket',
  },
  {
    value: 'TRAINING',
    label: 'Volunteer Training Event',
    description: 'Only shown to volunteers awaiting approval; staff approve attendees here.',
    icon: 'i-lucide-graduation-cap',
  },
]

/** The one authoritative mapping from type to stored columns. */
const EVENT_TYPE_FLAGS: Record<EventType, EventAudienceFlags> = {
  VOLUNTEERS_AND_ATTENDEES: { allowVolunteers: true, allowAttendees: true, isTraining: false },
  VOLUNTEERS: { allowVolunteers: true, allowAttendees: false, isTraining: false },
  ATTENDEES: { allowVolunteers: false, allowAttendees: true, isTraining: false },
  // Training is a volunteer-only event with an approval step attached to it.
  TRAINING: { allowVolunteers: true, allowAttendees: false, isTraining: true },
}

/** Narrows untrusted input (request bodies, query strings) to an `EventType`. */
export function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value)
}

/** The boolean columns to persist for a given event type. */
export function eventTypeToFlags(type: EventType): EventAudienceFlags {
  return { ...EVENT_TYPE_FLAGS[type] }
}

/**
 * The event type a stored event represents. Events created before the type
 * selector existed can have odd flag combinations; they collapse to the
 * closest type, and get normalized the next time they're saved.
 */
export function eventTypeFromFlags(flags: Partial<EventAudienceFlags> | null | undefined): EventType {
  if (flags?.isTraining) return 'TRAINING'
  if (flags?.allowVolunteers && flags?.allowAttendees) return 'VOLUNTEERS_AND_ATTENDEES'
  if (flags?.allowVolunteers) return 'VOLUNTEERS'
  return 'ATTENDEES'
}

/** Human-readable name for a type; falls back to the raw value if unknown. */
export function eventTypeLabel(type: EventType): string {
  return EVENT_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type
}

/** A volunteer's approval status, plus `NONE` for people who never applied. */
export type VolunteerStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

export interface EventViewer {
  isAdmin: boolean
  volunteerStatus: VolunteerStatus
}

/** The viewer to assume for logged-out requests — sees public events only. */
export const ANONYMOUS_VIEWER: EventViewer = { isAdmin: false, volunteerStatus: 'NONE' }

/**
 * Whether an event of this type should be visible to a given viewer.
 * Volunteer-only and training events are hidden from everyone else.
 */
export function canViewEventType(type: EventType, viewer: EventViewer): boolean {
  if (viewer.isAdmin) return true

  switch (type) {
    case 'ATTENDEES':
    case 'VOLUNTEERS_AND_ATTENDEES':
      return true
    case 'VOLUNTEERS':
      return viewer.volunteerStatus === 'APPROVED'
    case 'TRAINING':
      // A rejection is not a ban — unapproved volunteers can retry training.
      return viewer.volunteerStatus === 'PENDING' || viewer.volunteerStatus === 'REJECTED'
  }
}

/**
 * `canViewEventType` for a raw DB row — takes the stored boolean columns
 * instead of a resolved type. This is the form server routes usually want.
 */
export function canViewEvent(flags: Partial<EventAudienceFlags>, viewer: EventViewer): boolean {
  return canViewEventType(eventTypeFromFlags(flags), viewer)
}

/**
 * Whether the viewer can sign themselves up as a volunteer. Sign-up is
 * automatic — no staff approval — but it always requires a volunteer profile.
 */
export function canSignUpAsVolunteer(type: EventType, viewer: EventViewer): boolean {
  if (type === 'TRAINING') {
    return viewer.volunteerStatus === 'PENDING' || viewer.volunteerStatus === 'REJECTED'
  }
  if (type === 'VOLUNTEERS' || type === 'VOLUNTEERS_AND_ATTENDEES') {
    return viewer.volunteerStatus === 'APPROVED'
  }
  return false
}

/**
 * Whether this event takes attendee registrations at all. Unlike volunteer
 * sign-up it doesn't depend on the viewer — any account holder can attend an
 * event that allows attendees. It is *not* a permission check on its own:
 * registering still requires a session, which the caller has to establish
 * separately (see `events/[id]/rsvp.post.ts`).
 */
export function canRegisterAsAttendee(type: EventType): boolean {
  return type === 'ATTENDEES' || type === 'VOLUNTEERS_AND_ATTENDEES'
}
