/**
 * The one timezone this app speaks in.
 *
 * Abide operates in one place, so a date is worded for that place rather than
 * per-reader: an event starts at 9am because that's when people turn up at the
 * clinic, whatever zone the phone reading the page is in. Production runs the
 * server in UTC and browsers report wherever the reader is standing, so neither
 * host clock can be trusted — every date this app renders, buckets, or parses
 * goes through a helper that names this zone.
 *
 * It lives in its own module because four others need it and none of them
 * should own it: `shared/utils/reportRange.ts` (report boundaries),
 * `shared/utils/eventTime.ts` (every user-facing date string),
 * `server/utils/googleCalendar.ts` (the zone written onto synced events) and
 * `app/lib/chart.ts` (axis labels). Before it existed each kept its own copy of
 * the literal.
 */
export const ORG_TIME_ZONE = 'America/Chicago'
