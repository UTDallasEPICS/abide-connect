import { describe, expect, it } from 'vitest'
import {
  REPORT_TIME_ZONE,
  addZonedDays,
  addZonedMonths,
  autoGranularity,
  buildBuckets,
  bucketKey,
  dayKey,
  formatRangeLabel,
  monthKey,
  monthsBetweenKeys,
  previousYearRange,
  rangeDays,
  resolveCustomRange,
  resolvePreset,
  startOfZonedDay,
  startOfZonedMonth,
  startOfZonedWeek,
  zonedParts,
  zonedTime,
} from '#shared/utils/reportRange'

/**
 * The whole reporting stack is only as correct as this file: every total, every
 * bucket and every "which month was that" decision routes through it, and the
 * process timezone is UTC (see `vitest.config.ts`) exactly as it is in
 * production, so a helper that quietly falls back to the host zone fails here.
 *
 * Expected instants are written as literal UTC strings rather than computed, so
 * the test states the answer instead of restating the implementation. Central is
 * UTC-6 (CST) in winter and UTC-5 (CDT) between the second Sunday in March and
 * the first Sunday in November.
 */

describe('zonedParts', () => {
  it('reads calendar fields in Central, not UTC', () => {
    // 05:30 UTC on Jan 1 is still 11:30 PM on Dec 31 in Chicago.
    expect(zonedParts(new Date('2026-01-01T05:30:00Z'))).toEqual({
      year: 2025,
      month: 12,
      day: 31,
      hour: 23,
      weekday: 3, // Wednesday
    })
  })

  it('uses a 24-hour clock so midnight is hour 0, not 24', () => {
    expect(zonedParts(new Date('2026-01-01T06:00:00Z')).hour).toBe(0)
    expect(zonedParts(new Date('2026-01-01T18:00:00Z')).hour).toBe(12)
  })

  it('tracks the daylight-saving offset', () => {
    // CST: UTC-6. 12:00 UTC reads as 6am.
    expect(zonedParts(new Date('2026-01-15T12:00:00Z')).hour).toBe(6)
    // CDT: UTC-5. The same UTC hour reads as 7am.
    expect(zonedParts(new Date('2026-07-15T12:00:00Z')).hour).toBe(7)
  })

  it('numbers weekdays the way Date.getDay does', () => {
    // Aug 17 2026 is a Monday.
    expect(zonedParts(new Date('2026-08-17T12:00:00Z')).weekday).toBe(1)
    expect(zonedParts(new Date('2026-08-16T12:00:00Z')).weekday).toBe(0)
    expect(zonedParts(new Date('2026-08-22T12:00:00Z')).weekday).toBe(6)
  })
})

describe('zonedTime', () => {
  it('resolves a Central wall clock to the right instant in both offsets', () => {
    expect(zonedTime(2026, 1, 1, 0).toISOString()).toBe('2026-01-01T06:00:00.000Z')
    expect(zonedTime(2026, 7, 1, 0).toISOString()).toBe('2026-07-01T05:00:00.000Z')
    expect(zonedTime(2026, 8, 17, 9).toISOString()).toBe('2026-08-17T14:00:00.000Z')
  })

  it('normalises out-of-range fields the way Date.UTC does', () => {
    // Month 13 is next January; day 0 is the last day of the previous month.
    expect(zonedTime(2026, 13, 1, 0).toISOString()).toBe(zonedTime(2027, 1, 1, 0).toISOString())
    expect(zonedTime(2026, 3, 0, 0).toISOString()).toBe(zonedTime(2026, 2, 28, 0).toISOString())
    expect(zonedTime(2026, 1, -28, 0).toISOString()).toBe(zonedTime(2025, 12, 3, 0).toISOString())
  })

  it('round-trips through zonedParts for every hour of a DST changeover day', () => {
    // Nov 1 2026 is the fall-back day: 1am–2am Central happens twice. Every
    // instant must still report the wall-clock hour it actually shows.
    for (let hour = 0; hour < 24; hour += 1) {
      const instant = zonedTime(2026, 11, 1, hour)
      const parts = zonedParts(instant)
      expect(parts.day, `hour ${hour}`).toBe(1)
      expect(parts.month).toBe(11)
    }
  })

  it('collapses the spring-forward hour that does not exist onto the hour before it', () => {
    // 2am never occurs on Mar 8 2026; the clock jumps 1:59:59 → 3:00:00.
    // Asking for it resolves to 1am CST, the instant just before the gap.
    const missing = zonedTime(2026, 3, 8, 2)
    expect(missing.toISOString()).toBe('2026-03-08T07:00:00.000Z')
    expect(zonedParts(missing).hour).toBe(1)

    // What matters for the reports: the surrounding boundaries are still exact,
    // and midnight — the only hour any range boundary uses — is unaffected.
    expect(zonedTime(2026, 3, 8, 0).toISOString()).toBe('2026-03-08T06:00:00.000Z')
    expect(zonedTime(2026, 3, 8, 3).toISOString()).toBe('2026-03-08T08:00:00.000Z')
    expect(zonedParts(zonedTime(2026, 3, 8, 0)).hour).toBe(0)
  })
})

describe('day, week and month boundaries', () => {
  it('startOfZonedDay uses the Central day, not the UTC one', () => {
    // 03:00 UTC on Aug 18 is 10pm on Aug 17 in Chicago.
    expect(startOfZonedDay(new Date('2026-08-18T03:00:00Z')).toISOString())
      .toBe('2026-08-17T05:00:00.000Z')
  })

  it('startOfZonedWeek snaps back to Monday', () => {
    const monday = '2026-08-17T05:00:00.000Z'
    for (const day of ['17', '18', '19', '20', '21', '22', '23']) {
      expect(startOfZonedWeek(new Date(`2026-08-${day}T18:00:00Z`)).toISOString(), day).toBe(monday)
    }
    // The following Monday starts a new week.
    expect(startOfZonedWeek(new Date('2026-08-24T18:00:00Z')).toISOString())
      .toBe('2026-08-24T05:00:00.000Z')
  })

  it('startOfZonedMonth files a late-evening log under the month it was worked', () => {
    // 01:00 UTC on Sep 1 is 8pm on Aug 31 in Chicago — an August shift.
    expect(startOfZonedMonth(new Date('2026-09-01T01:00:00Z')).toISOString())
      .toBe('2026-08-01T05:00:00.000Z')
  })

  it('addZonedDays advances calendar days, not fixed 24-hour spans', () => {
    // Crossing spring-forward: the day is 23 hours long, so a naive +86400000ms
    // would land at 1am on the 9th instead of midnight.
    const beforeDst = zonedTime(2026, 3, 7, 0)
    expect(addZonedDays(beforeDst, 2).toISOString()).toBe('2026-03-09T05:00:00.000Z')
    expect(zonedParts(addZonedDays(beforeDst, 2)).hour).toBe(0)

    // And back the other way, across fall-back.
    const beforeFallBack = zonedTime(2026, 10, 31, 0)
    expect(zonedParts(addZonedDays(beforeFallBack, 2)).day).toBe(2)
    expect(zonedParts(addZonedDays(beforeFallBack, 2)).hour).toBe(0)
  })

  it('addZonedMonths lands on the first of the target month', () => {
    expect(addZonedMonths(new Date('2026-08-17T12:00:00Z'), -11).toISOString())
      .toBe('2025-09-01T05:00:00.000Z')
    expect(addZonedMonths(new Date('2026-01-15T12:00:00Z'), 1).toISOString())
      .toBe('2026-02-01T06:00:00.000Z')
  })
})

describe('keys', () => {
  it('monthKey and dayKey are zero-padded and Central', () => {
    expect(monthKey(new Date('2026-09-01T01:00:00Z'))).toBe('2026-08')
    expect(dayKey(new Date('2026-09-01T01:00:00Z'))).toBe('2026-08-31')
    expect(dayKey(new Date('2026-01-05T18:00:00Z'))).toBe('2026-01-05')
  })

  it('monthsBetweenKeys counts whole months in both directions', () => {
    expect(monthsBetweenKeys('2026-01', '2026-01')).toBe(0)
    expect(monthsBetweenKeys('2026-01', '2026-08')).toBe(7)
    expect(monthsBetweenKeys('2025-11', '2026-02')).toBe(3)
    expect(monthsBetweenKeys('2026-08', '2026-01')).toBe(-7)
  })
})

describe('resolvePreset', () => {
  // Monday, Aug 17 2026, mid-afternoon Central.
  const now = new Date('2026-08-17T19:00:00Z')
  const iso = (preset: Parameters<typeof resolvePreset>[0]) => {
    const range = resolvePreset(preset, now)
    return [range.start.toISOString(), range.end.toISOString()]
  }

  it('ends every to-date preset at tomorrow midnight so today counts', () => {
    for (const preset of ['MTD', 'QTD', 'YTD', 'LAST_30', 'LAST_90', 'LAST_12_MONTHS'] as const) {
      expect(iso(preset)[1], preset).toBe('2026-08-18T05:00:00.000Z')
    }
  })

  it('starts MTD, QTD and YTD on the right calendar boundary', () => {
    expect(iso('MTD')[0]).toBe('2026-08-01T05:00:00.000Z')
    // August is in Q3, which begins in July.
    expect(iso('QTD')[0]).toBe('2026-07-01T05:00:00.000Z')
    expect(iso('YTD')[0]).toBe('2026-01-01T06:00:00.000Z')
  })

  it('picks the containing quarter for a month at each quarter edge', () => {
    const quarterStart = (month: number) => {
      const at = new Date(Date.UTC(2026, month - 1, 15, 18))
      return zonedParts(resolvePreset('QTD', at).start).month
    }
    expect([1, 2, 3].map(quarterStart)).toEqual([1, 1, 1])
    expect([4, 5, 6].map(quarterStart)).toEqual([4, 4, 4])
    expect([7, 8, 9].map(quarterStart)).toEqual([7, 7, 7])
    expect([10, 11, 12].map(quarterStart)).toEqual([10, 10, 10])
  })

  it('makes the rolling windows inclusive of today', () => {
    // "Last 30 days" must cover exactly 30 days, today included.
    expect(rangeDays(resolvePreset('LAST_30', now))).toBe(30)
    expect(rangeDays(resolvePreset('LAST_90', now))).toBe(90)
    expect(iso('LAST_30')[0]).toBe('2026-07-19T05:00:00.000Z')
  })

  it('LAST_12_MONTHS starts at the first of the month 11 months back', () => {
    // 12 whole calendar months, the current one included.
    expect(iso('LAST_12_MONTHS')[0]).toBe('2025-09-01T05:00:00.000Z')
  })

  it('PREVIOUS_YEAR is a closed calendar year, not a to-date window', () => {
    expect(iso('PREVIOUS_YEAR')).toEqual([
      '2025-01-01T06:00:00.000Z',
      '2026-01-01T06:00:00.000Z',
    ])
    expect(rangeDays(resolvePreset('PREVIOUS_YEAR', now))).toBe(365)
  })

  it('ALL_TIME reaches back far enough to precede any record', () => {
    expect(iso('ALL_TIME')[0]).toBe('2015-01-01T06:00:00.000Z')
  })

  it('rolls a month-start "now" back into the previous month for MTD', () => {
    // 02:00 UTC on Sep 1 is still Aug 31 in Central, so MTD is August.
    const lateAugust = new Date('2026-09-01T02:00:00Z')
    expect(resolvePreset('MTD', lateAugust).start.toISOString()).toBe('2026-08-01T05:00:00.000Z')
    expect(resolvePreset('MTD', lateAugust).end.toISOString()).toBe('2026-09-01T05:00:00.000Z')
  })

  it('keeps New Year\'s Eve in the outgoing year for YTD', () => {
    // The classic UTC bug: 03:00 UTC on Jan 1 2027 is 9pm Dec 31 2026 in Texas.
    const newYearsEve = new Date('2027-01-01T03:00:00Z')
    const ytd = resolvePreset('YTD', newYearsEve)
    expect(ytd.start.toISOString()).toBe('2026-01-01T06:00:00.000Z')
    expect(ytd.end.toISOString()).toBe('2027-01-01T06:00:00.000Z')
  })
})

describe('resolveCustomRange', () => {
  it('treats both endpoints as inclusive days', () => {
    const range = resolveCustomRange('2026-03-01', '2026-03-31')!
    expect(range.start.toISOString()).toBe('2026-03-01T06:00:00.000Z')
    // `to` is pushed to the following midnight so Mar 31 is fully covered.
    expect(range.end.toISOString()).toBe('2026-04-01T05:00:00.000Z')
    expect(rangeDays(range)).toBe(31)
  })

  it('accepts a single-day range', () => {
    const range = resolveCustomRange('2026-08-17', '2026-08-17')!
    expect(rangeDays(range)).toBe(1)
  })

  it('rejects anything it cannot parse rather than guessing', () => {
    expect(resolveCustomRange(undefined, '2026-03-31')).toBeNull()
    expect(resolveCustomRange('2026-03-01', undefined)).toBeNull()
    expect(resolveCustomRange('', '')).toBeNull()
    expect(resolveCustomRange('03/01/2026', '03/31/2026')).toBeNull()
    expect(resolveCustomRange('2026-3-1', '2026-3-31')).toBeNull()
    expect(resolveCustomRange('not-a-date', 'nope')).toBeNull()
  })

  it('rejects a backwards range', () => {
    expect(resolveCustomRange('2026-03-31', '2026-03-01')).toBeNull()
  })
})

describe('previousYearRange', () => {
  it('shifts a to-date range back exactly one calendar year', () => {
    const ytd = resolvePreset('YTD', new Date('2026-08-17T19:00:00Z'))
    const prior = previousYearRange(ytd)
    expect(dayKey(prior.start)).toBe('2025-01-01')
    // End is exclusive, so the comparison covers through Aug 17 2025.
    expect(dayKey(addZonedDays(prior.end, -1))).toBe('2025-08-17')
  })

  it('preserves the wall-clock boundary across a DST difference', () => {
    // Both years' Julys are in CDT, so both boundaries are 05:00 UTC.
    const range = { start: zonedTime(2026, 7, 1, 0), end: zonedTime(2026, 8, 1, 0) }
    const prior = previousYearRange(range)
    expect(prior.start.toISOString()).toBe('2025-07-01T05:00:00.000Z')
    expect(prior.end.toISOString()).toBe('2025-08-01T05:00:00.000Z')
    expect(zonedParts(prior.start).hour).toBe(0)
    expect(zonedParts(prior.end).hour).toBe(0)
  })

  it('shifts a whole leap February onto the 28-day one before it', () => {
    // The common leap-year case, and it is correct: the boundaries are the 1st
    // of each month, which exists in every year.
    const february = resolveCustomRange('2024-02-01', '2024-02-29')!
    const prior = previousYearRange(february)
    expect(formatRangeLabel(prior)).toBe('Feb 1 – Feb 28, 2023')
    expect(rangeDays(prior)).toBe(28)
  })

  it('anniversaries 29 February onto the 28th, the date that exists', () => {
    // A leap day has no counterpart in the comparison year. Normalising it
    // forward to 1 March would start the prior window a day late — and over a
    // single leap day it would push the start past the end and collapse the
    // comparison to nothing.
    const leapDayOnly = resolveCustomRange('2024-02-29', '2024-02-29')!
    const prior = previousYearRange(leapDayOnly)
    expect(dayKey(prior.start)).toBe('2023-02-28')
    expect(rangeDays(prior)).toBe(1)

    // And a longer range keeps its length, so the two periods are comparable.
    const throughMarch = resolveCustomRange('2024-02-29', '2024-03-31')!
    expect(rangeDays(throughMarch)).toBe(32)
    expect(rangeDays(previousYearRange(throughMarch))).toBe(32)
    expect(dayKey(previousYearRange(throughMarch).start)).toBe('2023-02-28')
  })

  it('still rolls the exclusive end forward, which is where 1 March is correct', () => {
    // A range ending 28 Feb 2024 has an exclusive end of the 29th. The prior
    // year's answer is 1 March — clamping it to 28 Feb would silently drop the
    // last day of the period being compared against.
    const february = resolveCustomRange('2024-02-01', '2024-02-28')!
    const prior = previousYearRange(february)
    expect(dayKey(prior.start)).toBe('2023-02-01')
    expect(formatRangeLabel(prior)).toBe('Feb 1 – Feb 28, 2023')
    expect(rangeDays(february)).toBe(28)
    expect(rangeDays(prior)).toBe(28)
  })

  it('keeps midnight when the same calendar date sat in the other offset a year earlier', () => {
    // Mar 10 2026 is CDT; Mar 10 2025 is also CDT (DST began Mar 9 2025), but
    // Mar 8 2026 (CST, the changeover day) maps to Mar 8 2025 (CST).
    const range = { start: zonedTime(2026, 3, 8, 0), end: zonedTime(2026, 3, 9, 0) }
    const prior = previousYearRange(range)
    expect(zonedParts(prior.start).hour).toBe(0)
    expect(zonedParts(prior.end).hour).toBe(0)
    expect(dayKey(prior.start)).toBe('2025-03-08')
  })
})

describe('autoGranularity', () => {
  const days = (count: number) => ({
    start: zonedTime(2026, 1, 1, 0),
    end: zonedTime(2026, 1, 1 + count, 0),
  })

  it('switches at the documented thresholds', () => {
    expect(autoGranularity(days(1))).toBe('day')
    expect(autoGranularity(days(31))).toBe('day')
    expect(autoGranularity(days(32))).toBe('week')
    expect(autoGranularity(days(183))).toBe('week')
    expect(autoGranularity(days(184))).toBe('month')
    expect(autoGranularity(days(366))).toBe('month')
  })

  it('is not thrown off by the hour a DST change adds or removes', () => {
    // Mar 1 – Mar 31 contains spring-forward, so the span is 31 days minus 1hr.
    const acrossDst = resolveCustomRange('2026-03-01', '2026-03-31')!
    expect(rangeDays(acrossDst)).toBe(31)
    expect(autoGranularity(acrossDst)).toBe('day')
  })
})

describe('buildBuckets', () => {
  it('emits one bucket per day, including days with no activity', () => {
    const range = resolveCustomRange('2026-08-01', '2026-08-07')!
    const buckets = buildBuckets(range, 'day')
    expect(buckets).toHaveLength(7)
    expect(buckets.map(b => b.key)).toEqual([
      '2026-08-01', '2026-08-02', '2026-08-03',
      '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07',
    ])
    expect(buckets[0]!.label).toBe('Aug 1')
  })

  it('starts weekly buckets on the Monday that contains the range start', () => {
    // Aug 5 2026 is a Wednesday; its week begins Mon Aug 3.
    const range = resolveCustomRange('2026-08-05', '2026-08-20')!
    const buckets = buildBuckets(range, 'week')
    expect(buckets[0]!.key).toBe('2026-08-03')
    expect(buckets.map(b => b.key)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17'])
  })

  it('labels monthly buckets with a two-digit year', () => {
    const range = resolveCustomRange('2025-11-15', '2026-02-10')!
    const buckets = buildBuckets(range, 'month')
    expect(buckets.map(b => b.label)).toEqual(['Nov 25', 'Dec 25', 'Jan 26', 'Feb 26'])
  })

  it('never skips or duplicates a day across a DST changeover', () => {
    for (const [from, to] of [['2026-03-06', '2026-03-11'], ['2026-10-30', '2026-11-04']]) {
      const range = resolveCustomRange(from!, to!)!
      const keys = buildBuckets(range, 'day').map(b => b.key)
      expect(new Set(keys).size, `${from}..${to}`).toBe(keys.length)
      expect(keys.length).toBe(6)
    }
  })

  it('caps a pathological range instead of building an unbounded axis', () => {
    const range = resolvePreset('ALL_TIME', new Date('2026-08-17T19:00:00Z'))
    expect(buildBuckets(range, 'day').length).toBeLessThanOrEqual(801)
  })
})

describe('bucketKey agrees with buildBuckets', () => {
  /**
   * The invariant the time-series panel rests on: the handler seeds a map from
   * `buildBuckets` and then looks up each row by `bucketKey`. A row whose key
   * isn't in the map is dropped silently, so the chart would understate the
   * total without any error anywhere.
   */
  const cases: [string, string][] = [
    ['2026-01-01', '2026-01-31'],
    ['2026-03-01', '2026-03-31'], // spring forward
    ['2026-10-25', '2026-11-08'], // fall back
    ['2025-12-15', '2026-01-15'], // year boundary
    ['2026-02-01', '2026-12-31'],
    ['2024-02-01', '2024-03-01'], // leap year
  ]

  for (const [from, to] of cases) {
    for (const granularity of ['day', 'week', 'month'] as const) {
      it(`${from}..${to} at ${granularity} grain`, () => {
        const range = resolveCustomRange(from, to)!
        const keys = new Set(buildBuckets(range, granularity).map(b => b.key))

        // Walk every hour in the range — a log's timestamp is not necessarily
        // midnight, and the evening hours are where a UTC slip would show up.
        for (let t = range.start.getTime(); t < range.end.getTime(); t += 3_600_000) {
          const key = bucketKey(new Date(t), granularity)
          expect(keys.has(key), `${new Date(t).toISOString()} → ${key}`).toBe(true)
        }
      })
    }
  }
})

describe('formatRangeLabel', () => {
  it('names the last day covered, not the exclusive end', () => {
    const range = resolveCustomRange('2026-01-01', '2026-08-13')!
    expect(formatRangeLabel(range)).toBe('Jan 1 – Aug 13, 2026')
  })

  it('repeats the year only when the range crosses one', () => {
    const sameYear = resolveCustomRange('2026-03-01', '2026-03-31')!
    expect(formatRangeLabel(sameYear)).toBe('Mar 1 – Mar 31, 2026')

    const crossYear = resolveCustomRange('2025-11-01', '2026-02-28')!
    expect(formatRangeLabel(crossYear)).toBe('Nov 1, 2025 – Feb 28, 2026')
  })

  it('labels a single-day range with that day at both ends', () => {
    expect(formatRangeLabel(resolveCustomRange('2026-08-17', '2026-08-17')!))
      .toBe('Aug 17 – Aug 17, 2026')
  })
})

describe('REPORT_TIME_ZONE', () => {
  it('is the org timezone the rest of the stack assumes', () => {
    expect(REPORT_TIME_ZONE).toBe('America/Chicago')
  })
})
