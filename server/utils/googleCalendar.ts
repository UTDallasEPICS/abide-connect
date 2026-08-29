import { ORG_TIME_ZONE } from '#shared/utils/timeZone'
import { auth } from './auth'

// Pushes Abide events to a single shared Google Calendar (the org calendar
// identified by GOOGLE_CALENDAR_ID). Writes are performed with the access token
// of the volunteer who created/edited the event, so that volunteer's Google
// account must have write access to the shared calendar. All calls are
// best-effort: on any failure we log and return null/false so the surrounding
// event operation (DB write) still succeeds.

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// Timezone Abide operates in — used so Google renders event times correctly.
const CALENDAR_TIME_ZONE = ORG_TIME_ZONE

export interface CalendarEventInput {
  title: string
  description?: string | null
  location?: string | null
  startTime: Date
  endTime: Date
}

export interface CalendarEventRef {
  id: string
  htmlLink: string | null
}

/**
 * The shared calendar every event is mirrored to. Returns null (rather than
 * throwing) when unconfigured, which is what makes sync opt-in: a dev machine
 * without `GOOGLE_CALENDAR_ID` runs the whole event flow with sync skipped.
 */
function getCalendarId(): string | null {
  const id = process.env.GOOGLE_CALENDAR_ID
  if (!id) {
    console.warn('[googleCalendar] GOOGLE_CALENDAR_ID is not set — skipping calendar sync')
    return null
  }
  return id
}

/**
 * Resolve a valid Google access token for the given volunteer, refreshing it
 * via the stored refresh token if it has expired. Returns null if the user has
 * no linked Google account (e.g. they signed in with email OTP).
 */
async function getGoogleAccessToken(userId: string): Promise<string | null> {
  try {
    const result = await auth.api.getAccessToken({
      body: { providerId: 'google', userId },
    })
    return result?.accessToken ?? null
  }
  catch (error) {
    console.warn('[googleCalendar] No Google access token for volunteer', userId, error)
    return null
  }
}

// Format an absolute instant as a naive RFC3339 wall-clock string ("YYYY-MM-DDTHH:MM:SS")
// in CALENDAR_TIME_ZONE, with NO trailing "Z"/offset. Google interprets this together
// with the `timeZone` field below. Sending a UTC ("Z") dateTime *and* a timeZone makes
// Google read the clock portion as local time, shifting the event by the zone offset.
function toCalendarDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  // Some engines emit "24" for midnight when hour12 is false — normalize to "00".
  const hour = get('hour') === '24' ? '00' : get('hour')

  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`
}

/** Maps an Abide event onto the Google Calendar `events` resource shape. */
function toCalendarResource(input: CalendarEventInput) {
  return {
    summary: input.title,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: {
      dateTime: toCalendarDateTime(input.startTime),
      timeZone: CALENDAR_TIME_ZONE,
    },
    end: {
      dateTime: toCalendarDateTime(input.endTime),
      timeZone: CALENDAR_TIME_ZONE,
    },
  }
}

/**
 * Create a new entry on the shared Google Calendar. Returns the created event's
 * id and htmlLink, or null if the sync was skipped or failed.
 */
export async function createCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<CalendarEventRef | null> {
  const calendarId = getCalendarId()
  if (!calendarId) return null

  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) return null

  try {
    const response = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toCalendarResource(input)),
      },
    )

    if (!response.ok) {
      console.warn('[googleCalendar] Failed to create calendar event:', response.status, await response.text())
      return null
    }

    const created = await response.json()
    console.log('📆 Pushed event to shared calendar:', created.id)
    return { id: created.id, htmlLink: created.htmlLink ?? null }
  }
  catch (error) {
    console.error('[googleCalendar] Error creating calendar event:', error)
    return null
  }
}

/**
 * Update an existing shared-calendar entry to match the Abide event. Returns the
 * updated event ref, or null if the sync was skipped or failed.
 */
export async function updateCalendarEvent(
  userId: string,
  calendarEventId: string,
  input: CalendarEventInput,
): Promise<CalendarEventRef | null> {
  const calendarId = getCalendarId()
  if (!calendarId) return null

  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) return null

  try {
    const response = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(calendarEventId)}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(toCalendarResource(input)),
      },
    )

    if (!response.ok) {
      console.warn('[googleCalendar] Failed to update calendar event:', response.status, await response.text())
      return null
    }

    const updated = await response.json()
    console.log('📆 Updated shared calendar event:', updated.id)
    return { id: updated.id, htmlLink: updated.htmlLink ?? null }
  }
  catch (error) {
    console.error('[googleCalendar] Error updating calendar event:', error)
    return null
  }
}

/**
 * Remove a shared-calendar entry. Returns true if the entry was deleted (or was
 * already gone), false if the sync was skipped or failed.
 */
export async function deleteCalendarEvent(
  userId: string,
  calendarEventId: string,
): Promise<boolean> {
  const calendarId = getCalendarId()
  if (!calendarId) return false

  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) return false

  try {
    const response = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(calendarEventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    )

    // 200/204 = deleted, 410 = already gone — both are fine.
    if (response.ok || response.status === 410) {
      console.log('📆 Removed shared calendar event:', calendarEventId)
      return true
    }

    console.warn('[googleCalendar] Failed to delete calendar event:', response.status, await response.text())
    return false
  }
  catch (error) {
    console.error('[googleCalendar] Error deleting calendar event:', error)
    return false
  }
}
