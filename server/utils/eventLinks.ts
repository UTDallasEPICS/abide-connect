/**
 * Absolute links for everything that talks to a participant about an event —
 * the reminder cron, the sign-up confirmation email, and the push payloads.
 *
 * The date *wording* these messages use is not here: it comes from
 * `#shared/utils/eventTime`, the one module that formats a date in this app, so
 * an email and the page it links to say the same thing. This file used to own a
 * second `formatEventDateTime` alongside that one, which is a trap in server
 * code where `server/utils/*` is auto-imported.
 */

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
