import { describe, expect, it } from 'vitest'
import {
  eventDateBadge,
  formatEventDate,
  formatEventDateTime,
  formatEventLongDateTime,
  formatEventSchedule,
  formatEventTime,
  formatEventWhen,
  formatLongDate,
  formatMonthDay,
  formatShortDate,
  formatShortDateTime,
  formatTimeRange,
  fromDateTimeLocal,
  isSameZonedDay,
  parseZonedDate,
  toDateTimeLocal,
  zonedDateKey,
  zonedDayBounds,
  zonedDayBoundsForDate,
  zonedWeekBounds,
} from '#shared/utils/eventTime'
import { REPORT_TIME_ZONE } from '#shared/utils/reportRange'
import { ORG_TIME_ZONE } from '#shared/utils/timeZone'

/**
 * The suite runs with `TZ=UTC`, like production does, and that is the point of
 * nearly every case here: each instant below is one whose date or time in UTC
 * differs from its date or time in Central. Formatting any of them on the host
 * clock — which is what a bare `toLocaleDateString` does — gives the answer
 * these assertions reject.
 *
 * `2025-09-01T00:00:00Z` recurs throughout: 7:00 PM on Sunday August 31 here,
 * the shape of event that had the home page printing two different dates for
 * one event.
 */

const EVENING = '2025-09-01T00:00:00.000Z'

describe('the org timezone', () => {
  it('is the one the reports are cut in', () => {
    expect(ORG_TIME_ZONE).toBe('America/Chicago')
    expect(REPORT_TIME_ZONE).toBe(ORG_TIME_ZONE)
  })
})

describe('times', () => {
  it('reads an instant as the wall clock here', () => {
    expect(formatEventTime(EVENING)).toBe('7:00 PM')
  })

  it('follows the DST switch', () => {
    // 18:00 UTC is noon in winter and 1pm in summer.
    expect(formatEventTime('2025-01-15T18:00:00.000Z')).toBe('12:00 PM')
    expect(formatEventTime('2025-07-15T18:00:00.000Z')).toBe('1:00 PM')
  })

  it('renders a block as a range', () => {
    expect(formatTimeRange('2025-07-15T15:00:00.000Z', '2025-07-15T16:00:00.000Z'))
      .toBe('10:00 AM - 11:00 AM')
  })
})

describe('dates', () => {
  it('puts an evening instant on the day it is here, not the UTC one', () => {
    expect(formatEventDate(EVENING)).toBe('Sun, August 31')
    expect(formatShortDate(EVENING)).toBe('Aug 31, 2025')
    expect(formatLongDate(EVENING)).toBe('August 31, 2025')
    expect(formatMonthDay(EVENING)).toBe('Aug 31')
    expect(zonedDateKey(EVENING)).toBe('2025-08-31')
  })

  it('accepts a Date, a string or an epoch', () => {
    expect(formatShortDate(new Date(EVENING))).toBe('Aug 31, 2025')
    expect(formatShortDate(new Date(EVENING).getTime())).toBe('Aug 31, 2025')
  })
})

describe('eventDateBadge', () => {
  it('agrees with the date line for the same instant', () => {
    // The home page bug: this badge is built on the server and the line under
    // it in the browser. They have to name one day.
    expect(eventDateBadge(EVENING)).toEqual({ day: '31', month: 'Aug' })
    expect(formatEventDateTime(EVENING)).toBe('Sun, August 31 • 7:00 PM')
  })

  it('zero-pads the day', () => {
    expect(eventDateBadge('2025-08-08T15:00:00.000Z')).toEqual({ day: '08', month: 'Aug' })
  })
})

describe('composed formats', () => {
  it('formats a record timestamp', () => {
    expect(formatShortDateTime(EVENING)).toBe('Aug 31, 2025, 7:00 PM')
  })

  it('formats an event page heading with its end time', () => {
    expect(formatEventSchedule(EVENING, '2025-09-01T02:00:00.000Z'))
      .toBe('Sunday, August 31 • 7:00 PM - 9:00 PM')
  })

  it('drops the range when an event has no end', () => {
    expect(formatEventSchedule(EVENING)).toBe('Sunday, August 31 • 7:00 PM')
    expect(formatEventSchedule(EVENING, null)).toBe('Sunday, August 31 • 7:00 PM')
  })
})

describe('formatEventWhen', () => {
  // The wording emails and push notifications have always used. Kept exactly,
  // because these strings are what people have been reading in their inbox.
  it('reads as a sentence', () => {
    expect(formatEventLongDateTime('2026-03-04T15:00:00.000Z')).toBe('Wednesday, March 4 at 9:00 AM')
    expect(formatEventWhen('2026-03-04T15:00:00.000Z', '2026-03-04T18:00:00.000Z'))
      .toBe('Wednesday, March 4 at 9:00 AM – 12:00 PM')
  })

  it('gives just the start when the end is missing', () => {
    expect(formatEventWhen('2026-03-04T15:00:00.000Z')).toBe('Wednesday, March 4 at 9:00 AM')
    expect(formatEventWhen('2026-03-04T15:00:00.000Z', null)).toBe('Wednesday, March 4 at 9:00 AM')
  })

  it('gives just the start when the event runs past midnight here', () => {
    // 03:00Z the next day is 9pm the same evening in Central — still one day —
    // while 07:00Z is 1am, which is not.
    expect(formatEventWhen(EVENING, '2025-09-01T02:00:00.000Z'))
      .toBe('Sunday, August 31 at 7:00 PM – 9:00 PM')
    expect(formatEventWhen(EVENING, '2025-09-01T07:00:00.000Z'))
      .toBe('Sunday, August 31 at 7:00 PM')
  })
})

describe('isSameZonedDay', () => {
  it('splits the day where this timezone does', () => {
    // 04:59Z is 11:59 PM on the 31st here; 05:01Z is the 1st.
    expect(isSameZonedDay(EVENING, '2025-09-01T04:59:00.000Z')).toBe(true)
    expect(isSameZonedDay(EVENING, '2025-09-01T05:01:00.000Z')).toBe(false)
  })
})

describe('zonedDayBounds', () => {
  it('brackets the day an evening instant falls in', () => {
    const { start, end } = zonedDayBounds(EVENING)
    expect(start.toISOString()).toBe('2025-08-31T05:00:00.000Z')
    expect(end.toISOString()).toBe('2025-09-01T04:59:59.999Z')
  })
})

describe('zonedDayBoundsForDate', () => {
  it('reads YYYY-MM-DD as a day here, not a UTC one', () => {
    const { start, end } = zonedDayBoundsForDate('2025-08-31')
    expect(start.toISOString()).toBe('2025-08-31T05:00:00.000Z')
    expect(end.toISOString()).toBe('2025-09-01T04:59:59.999Z')
  })

  it('holds an evening event on the date it was asked for', () => {
    const { start, end } = zonedDayBoundsForDate('2025-08-31')
    const evening = new Date(EVENING)
    expect(evening.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(evening.getTime()).toBeLessThanOrEqual(end.getTime())
  })

  it('crosses a month end', () => {
    expect(zonedDayBoundsForDate('2025-12-31').end.toISOString()).toBe('2026-01-01T05:59:59.999Z')
  })
})

describe('zonedWeekBounds', () => {
  it('runs Sunday 00:00 to Saturday 23:59:59.999', () => {
    // Wednesday Aug 27 2025, 3pm Central.
    const { start, end } = zonedWeekBounds('2025-08-27T20:00:00.000Z')
    expect(start.toISOString()).toBe('2025-08-24T05:00:00.000Z')
    expect(end.toISOString()).toBe('2025-08-31T04:59:59.999Z')
  })

  it('keeps a late Saturday event inside the week', () => {
    const { end } = zonedWeekBounds('2025-08-27T20:00:00.000Z')
    // Sat Aug 30, 11pm Central is Aug 31 04:00 UTC — still this week.
    expect(new Date('2025-08-31T04:00:00.000Z').getTime()).toBeLessThan(end.getTime())
  })
})

describe('parseZonedDate', () => {
  it('reads a date-only form value as midnight here', () => {
    // Not `2026-03-04T00:00:00Z`, which is 6pm on the 3rd here and is what
    // `new Date('2026-03-04')` gives you.
    expect(parseZonedDate('2026-03-04').toISOString()).toBe('2026-03-04T06:00:00.000Z')
    expect(zonedDateKey(parseZonedDate('2026-03-04'))).toBe('2026-03-04')
  })

  it('keeps the day across a DST switch and a year end', () => {
    expect(zonedDateKey(parseZonedDate('2026-07-04'))).toBe('2026-07-04')
    expect(zonedDateKey(parseZonedDate('2026-01-01'))).toBe('2026-01-01')
    expect(zonedDateKey(parseZonedDate('2026-12-31'))).toBe('2026-12-31')
  })

  it('passes a full timestamp through as the instant it already is', () => {
    expect(parseZonedDate('2026-03-04T15:30:00.000Z').toISOString()).toBe('2026-03-04T15:30:00.000Z')
  })

  it('gives an invalid Date for junk, so callers can still check it', () => {
    expect(Number.isNaN(parseZonedDate('not a date').getTime())).toBe(true)
    expect(Number.isNaN(parseZonedDate('').getTime())).toBe(true)
  })
})

describe('datetime-local fields', () => {
  it('shows an admin the wall clock here, whatever their own zone', () => {
    expect(toDateTimeLocal('2026-03-04T15:00:00.000Z')).toBe('2026-03-04T09:00')
    expect(toDateTimeLocal(EVENING)).toBe('2025-08-31T19:00')
  })

  it('reads back what was typed as that same wall clock', () => {
    expect(fromDateTimeLocal('2026-03-04T09:00').toISOString()).toBe('2026-03-04T15:00:00.000Z')
  })

  it('round-trips, or editing an event would silently move it', () => {
    for (const iso of [EVENING, '2026-03-04T15:00:00.000Z', '2026-07-04T00:30:00.000Z', '2026-11-01T05:45:00.000Z']) {
      expect(fromDateTimeLocal(toDateTimeLocal(iso)).toISOString()).toBe(iso)
    }
  })

  it('gives an invalid Date for junk', () => {
    expect(Number.isNaN(fromDateTimeLocal('nope').getTime())).toBe(true)
  })
})
