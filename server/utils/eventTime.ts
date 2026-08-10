/**
 * Date wording and absolute links shared by everything that talks to a
 * participant about an event — the reminder cron, the sign-up confirmation
 * email, and the push payloads.
 */

/**
 * Timezone every message is worded in. Abide operates in one place, so times
 * are formatted for that place rather than per-recipient — matching the `cron`
 * block in nuxt.config.ts, which schedules the reminder job in the same zone.
 */
export const TIME_ZONE = 'America/Chicago'

/** "Tuesday, March 4 at 9:00 AM" — the headline date in emails. */
export function formatEventDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date).replace(/, (\d{1,2}:\d{2})/, ' at $1')
}

/** "9:00 AM" — used where the surrounding copy already supplies the day. */
export function formatEventTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date)
}

/**
 * "Tuesday, March 4 at 9:00 AM – 12:00 PM", collapsing to the start alone when
 * the end is missing or not on the same day — a multi-day range spelled out in
 * one line reads worse than just telling people when to turn up.
 */
export function formatEventWhen(start: Date, end?: Date | null): string {
  const startText = formatEventDateTime(start)
  if (!end || !isSameDay(start, end)) return startText
  return `${startText} – ${formatEventTime(end)}`
}

function isSameDay(a: Date, b: Date): boolean {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, dateStyle: 'short' })
  return format.format(a) === format.format(b)
}

/** `20260304T150000Z` — the timestamp format Google Calendar links expect. */
function toCalendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, '')
}

/**
 * "Add to Google Calendar" link for a confirmation email.
 *
 * Built from the event's own fields rather than from `Event.calendarURL`: that
 * one points at Abide's shared staff calendar, which a guest can't open, while
 * this drops a copy into whatever calendar the recipient is signed in to.
 */
export function addToCalendarUrl(event: {
  title: string
  description?: string | null
  startTime: Date
  endTime: Date
  location?: string | null
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toCalendarStamp(event.startTime)}/${toCalendarStamp(event.endTime)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Where an event address can be opened, one entry per maps app. */
export interface MapUrls {
  /** Drops a pin on the address — "where is this". */
  place: string
  /** Turn-by-turn directions in Apple Maps. */
  appleDirections: string
  /** Turn-by-turn directions in Google Maps. */
  googleDirections: string
}

/**
 * Links that open an event's address in a maps app, so a reader can go from the
 * email to navigation without retyping the address.
 *
 * An email can't run JavaScript, so there's no way to detect which maps app the
 * reader has and hand them just that one — both are offered and they pick.
 * These are universal links: on a phone they open the native app, on a desktop
 * the same place on the web.
 *
 * The address goes across as a search query rather than as the coordinates we
 * also hold, so what the maps app looks up is the text the email displayed.
 * Returns null for a blank address, which callers use to drop the links.
 */
export function mapUrls(address: string | null | undefined): MapUrls | null {
  const query = address?.trim()
  if (!query) return null

  // encodeURIComponent rather than URLSearchParams: the latter writes spaces as
  // `+`, which Apple Maps does not reliably read back as a space.
  const encoded = encodeURIComponent(query)

  return {
    place: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    // `dirflg=d` asks for driving directions; Apple Maps picks its own default
    // otherwise, which on a Mac can be transit.
    appleDirections: `https://maps.apple.com/?daddr=${encoded}&dirflg=d`,
    googleDirections: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
  }
}

/**
 * Absolute URL for a path, for links in emails. Reuses `BETTER_AUTH_URL`, which
 * is already required and already has to be the app's public origin.
 */
export function appUrl(path: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? '').replace(/\/$/, '')
  return `${base}${path}`
}
