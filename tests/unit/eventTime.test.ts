import { describe, expect, it } from 'vitest'
import {
  eventDateBadge,
  formatEventDateTime,
  zonedDayBounds,
  zonedDayBoundsForDate,
  zonedWeekBounds,
} from '#shared/utils/eventTime'

/**
 * The suite runs with `TZ=UTC`, like production does, which is the whole point:
 * every case below is an event whose Central date and whose UTC date differ.
 * Before these helpers existed the home page rendered the card badge on the
 * server (UTC) and the date line in the browser (local), so an evening event
 * appeared under two different days on the same screen.
 */
describe('eventDateBadge', () => {
  it('reads an evening event as the Central day, not the UTC one', () => {
    // 7:00 PM CDT on Aug 31 is 00:00 UTC on Sep 1.
    expect(eventDateBadge('2025-09-01T00:00:00.000Z')).toEqual({ day: '31', month: 'Aug' })
  })

  it('zero-pads the day', () => {
    expect(eventDateBadge('2025-08-08T15:00:00.000Z')).toEqual({ day: '08', month: 'Aug' })
  })

  it('accepts a Date as well as a string', () => {
    expect(eventDateBadge(new Date('2025-09-01T00:00:00.000Z'))).toEqual({ day: '31', month: 'Aug' })
  })

  it('agrees with the formatted date line for the same instant', () => {
    const instant = '2025-09-01T00:00:00.000Z'
    expect(eventDateBadge(instant)).toEqual({ day: '31', month: 'Aug' })
    expect(formatEventDateTime(instant)).toBe('Sun, August 31 • 7:00 PM')
  })
})

describe('formatEventDateTime', () => {
  it('renders CST in winter', () => {
    // 18:00 UTC in January is noon Central.
    expect(formatEventDateTime('2025-01-15T18:00:00.000Z')).toBe('Wed, January 15 • 12:00 PM')
  })

  it('renders CDT in summer', () => {
    // 18:00 UTC in July is 1pm Central.
    expect(formatEventDateTime('2025-07-15T18:00:00.000Z')).toBe('Tue, July 15 • 1:00 PM')
  })
})

describe('zonedDayBounds', () => {
  it('brackets the Central day an evening instant falls in', () => {
    const { start, end } = zonedDayBounds('2025-09-01T00:00:00.000Z')
    // Aug 31 00:00 CDT = Aug 31 05:00 UTC; the day ends a millisecond before
    // Sep 1 00:00 CDT = Sep 1 05:00 UTC.
    expect(start.toISOString()).toBe('2025-08-31T05:00:00.000Z')
    expect(end.toISOString()).toBe('2025-09-01T04:59:59.999Z')
  })
})

describe('zonedDayBoundsForDate', () => {
  it('reads YYYY-MM-DD as a Central day, not a UTC one', () => {
    const { start, end } = zonedDayBoundsForDate('2025-08-31')
    expect(start.toISOString()).toBe('2025-08-31T05:00:00.000Z')
    expect(end.toISOString()).toBe('2025-09-01T04:59:59.999Z')
  })

  it('holds an evening event on the date it is asked for', () => {
    // 7pm Central on Aug 31 — an instant whose UTC date is Sep 1.
    const evening = new Date('2025-09-01T00:00:00.000Z')
    const { start, end } = zonedDayBoundsForDate('2025-08-31')
    expect(evening.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(evening.getTime()).toBeLessThanOrEqual(end.getTime())
  })

  it('crosses a month end', () => {
    const { end } = zonedDayBoundsForDate('2025-12-31')
    expect(end.toISOString()).toBe('2026-01-01T05:59:59.999Z')
  })
})

describe('zonedWeekBounds', () => {
  it('runs Sunday 00:00 to Saturday 23:59:59.999 Central', () => {
    // Wed Aug 27 2025, 3pm Central.
    const { start, end } = zonedWeekBounds('2025-08-27T20:00:00.000Z')
    // Sunday Aug 24 00:00 CDT = 05:00 UTC.
    expect(start.toISOString()).toBe('2025-08-24T05:00:00.000Z')
    // Sunday Aug 31 00:00 CDT = 05:00 UTC, less a millisecond.
    expect(end.toISOString()).toBe('2025-08-31T04:59:59.999Z')
  })

  it('keeps an event late on Saturday Central inside the week', () => {
    const { end } = zonedWeekBounds('2025-08-27T20:00:00.000Z')
    // Sat Aug 30, 11pm CDT = Aug 31 04:00 UTC — still this week.
    expect(new Date('2025-08-31T04:00:00.000Z').getTime()).toBeLessThan(end.getTime())
  })
})
