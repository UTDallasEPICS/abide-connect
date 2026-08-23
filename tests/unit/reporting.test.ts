import { describe, expect, it } from 'vitest'
import {
  FULL_TIME_HOURS_PER_YEAR,
  HISTOGRAM_BINS,
  PROGRAM_LABELS,
  TIME_BANDS,
  UNASSIGNED_PROGRAM,
  attributeProgram,
  bandForHour,
  binHours,
  daysBetween,
  mean,
  median,
  programLabel,
  round,
  statusFilter,
  sum,
  topDecileShare,
  volunteersForHalfOfHours,
} from '#server/utils/reporting'

/**
 * The statistics behind every tile on `/admin/reports`.
 *
 * These are checked against hand-computed answers, not against a second
 * implementation of the same formula — the point is to catch a definition that
 * is subtly wrong (a median that ignores the middle pair, a decile that rounds
 * down to zero people), which restating the code would not.
 */

describe('sum and mean', () => {
  it('sums an empty list to zero rather than undefined', () => {
    expect(sum([])).toBe(0)
    expect(sum([2.5, 3.5, 4])).toBe(10)
  })

  it('means an empty list to zero rather than NaN', () => {
    // An empty range is the normal state of a brand-new install; NaN here would
    // render as "NaN hrs" on the dashboard.
    expect(mean([])).toBe(0)
    expect(mean([2, 4, 9])).toBe(5)
  })
})

describe('median', () => {
  it('averages the middle pair on an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('takes the middle value on an odd-length list', () => {
    expect(median([5, 1, 3])).toBe(3)
  })

  it('sorts numerically, not lexicographically', () => {
    // The bug this guards: [...].sort() would order these 10, 2, 9 and answer 2.
    expect(median([2, 9, 10])).toBe(9)
    expect(median([100, 9, 80, 7, 60])).toBe(60)
  })

  it('does not mutate its input', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })

  it('is zero for an empty list', () => {
    expect(median([])).toBe(0)
  })
})

describe('round', () => {
  it('defaults to one decimal place', () => {
    expect(round(12.34)).toBe(12.3)
    expect(round(12.35)).toBe(12.4)
  })

  it('takes a place count for currency', () => {
    expect(round(1234.5678, 2)).toBe(1234.57)
    expect(round(87.5, 0)).toBe(88)
  })

  it('survives binary floating-point representation', () => {
    // 1.005 is really 1.00499999…; the epsilon nudge is what makes this 1.01.
    expect(round(1.005, 2)).toBe(1.01)
    expect(round(0.1 + 0.2, 1)).toBe(0.3)
    // A long chain of half-hour logs must not drift.
    expect(round(sum(Array.from({ length: 10 }, () => 0.1)))).toBe(1)
  })

  it('keeps whole numbers whole', () => {
    expect(round(40)).toBe(40)
    expect(round(0)).toBe(0)
  })
})

describe('daysBetween', () => {
  it('counts whole elapsed days, truncating a partial one', () => {
    const from = new Date('2026-08-01T00:00:00Z')
    expect(daysBetween(from, new Date('2026-08-01T23:59:00Z'))).toBe(0)
    expect(daysBetween(from, new Date('2026-08-02T00:00:00Z'))).toBe(1)
    expect(daysBetween(from, new Date('2026-08-31T12:00:00Z'))).toBe(30)
  })

  it('goes negative for a future date rather than wrapping', () => {
    expect(daysBetween(new Date('2026-08-10T00:00:00Z'), new Date('2026-08-08T00:00:00Z')))
      .toBe(-2)
  })
})

describe('topDecileShare', () => {
  it('is the busiest tenth\'s share of the total', () => {
    // 20 volunteers: two at 50, eighteen at 5 → 100 of 190 hours in the top 10%.
    const hours = [50, 50, ...Array.from({ length: 18 }, () => 5)]
    expect(round(topDecileShare(hours) * 100)).toBe(52.6)
  })

  it('always takes at least one volunteer, however small the roster', () => {
    // 10% of 4 people rounds up to 1, not down to 0 — a zero share would read
    // as a perfectly flat distribution.
    expect(topDecileShare([40, 10, 10, 10])).toBeCloseTo(40 / 70, 10)
    expect(topDecileShare([10])).toBe(1)
  })

  it('is zero when nobody logged anything', () => {
    expect(topDecileShare([])).toBe(0)
    expect(topDecileShare([0, 0, 0])).toBe(0)
  })

  it('does not mutate its input', () => {
    const input = [1, 9, 5]
    topDecileShare(input)
    expect(input).toEqual([1, 9, 5])
  })
})

describe('volunteersForHalfOfHours', () => {
  it('counts the fewest people who together cover half the hours', () => {
    // 100 total; the top two (40 + 30) reach 50 first.
    expect(volunteersForHalfOfHours([40, 30, 20, 10])).toBe(2)
  })

  it('is 1 when a single volunteer already carries half', () => {
    expect(volunteersForHalfOfHours([60, 10, 10, 10, 10])).toBe(1)
  })

  it('is half the roster when everyone contributed equally', () => {
    expect(volunteersForHalfOfHours(Array.from({ length: 10 }, () => 5))).toBe(5)
  })

  it('is zero when there are no hours to divide', () => {
    expect(volunteersForHalfOfHours([])).toBe(0)
    expect(volunteersForHalfOfHours([0, 0])).toBe(0)
  })
})

describe('binHours', () => {
  it('places each volunteer in exactly one bin', () => {
    const hours = [0, 3, 5, 9.9, 10, 19, 20, 39, 40, 79, 80, 159, 160, 500]
    const bins = binHours(hours)
    expect(sum(bins.map(bin => bin.volunteers))).toBe(hours.length)
  })

  it('treats each boundary as the start of the upper bin', () => {
    // 5 hours belongs to "5–10", not to "0–5" — otherwise the same volunteer
    // could be counted in both and the histogram would sum past the headcount.
    const byLabel = Object.fromEntries(binHours([5, 10, 20, 40, 80, 160]).map(b => [b.label, b.volunteers]))
    expect(byLabel).toMatchObject({
      '0–5': 0,
      '5–10': 1,
      '10–20': 1,
      '20–40': 1,
      '40–80': 1,
      '80–160': 1,
      '160+': 1,
    })
  })

  it('keeps the open-ended top bin open', () => {
    const bins = binHours([160, 1000, 99_999])
    expect(bins.at(-1)!.volunteers).toBe(3)
    expect(HISTOGRAM_BINS.at(-1)!.to).toBeNull()
  })

  it('returns every bin even when the range is empty, so the axis is stable', () => {
    const bins = binHours([])
    expect(bins).toHaveLength(HISTOGRAM_BINS.length)
    expect(bins.every(bin => bin.volunteers === 0)).toBe(true)
  })
})

describe('bandForHour', () => {
  it('maps each hour of the day to exactly one band', () => {
    const counts = new Map<string, number>()
    for (let hour = 0; hour < 24; hour += 1) {
      const band = bandForHour(hour)
      expect(TIME_BANDS.map(b => b.id)).toContain(band)
      counts.set(band, (counts.get(band) ?? 0) + 1)
    }
    // Night wraps midnight: 22, 23, 0, 1, 2, 3, 4.
    expect(Object.fromEntries(counts)).toEqual({
      MORNING: 7, AFTERNOON: 5, EVENING: 5, NIGHT: 7,
    })
  })

  it('puts each band boundary in the later band', () => {
    expect(bandForHour(5)).toBe('MORNING')
    expect(bandForHour(11)).toBe('MORNING')
    expect(bandForHour(12)).toBe('AFTERNOON')
    expect(bandForHour(16)).toBe('AFTERNOON')
    expect(bandForHour(17)).toBe('EVENING')
    expect(bandForHour(21)).toBe('EVENING')
    expect(bandForHour(22)).toBe('NIGHT')
    expect(bandForHour(0)).toBe('NIGHT')
    expect(bandForHour(4)).toBe('NIGHT')
  })
})

describe('attributeProgram', () => {
  it('trusts an explicit program tag over the volunteer\'s areas', () => {
    expect(attributeProgram('CLINIC_SUPPORT', ['EVENT_SUPPORT', 'COMMUNITY_OUTREACH']))
      .toEqual({ program: 'CLINIC_SUPPORT', inferred: false })
  })

  it('falls back to a single declared area and flags it as inferred', () => {
    expect(attributeProgram(null, ['MOBILE_CLINIC_OUTREACH']))
      .toEqual({ program: 'MOBILE_CLINIC_OUTREACH', inferred: true })
  })

  it('refuses to guess when the volunteer declared several areas', () => {
    // Splitting a shift across three areas would invent numbers a grant report
    // cannot defend, so these land in Unassigned instead.
    expect(attributeProgram(null, ['CLINIC_SUPPORT', 'EVENT_SUPPORT']))
      .toEqual({ program: UNASSIGNED_PROGRAM, inferred: false })
  })

  it('is unassigned — and not inferred — when there is nothing to go on', () => {
    expect(attributeProgram(null, [])).toEqual({ program: UNASSIGNED_PROGRAM, inferred: false })
  })
})

describe('programLabel', () => {
  it('names every program the schema can store', () => {
    const areas = [
      'CLINIC_SUPPORT', 'MOBILE_CLINIC_OUTREACH', 'EVENT_SUPPORT',
      'COMMUNITY_OUTREACH', 'ADMINISTRATIVE_TASKS', 'OTHER',
    ]
    for (const area of areas) {
      expect(PROGRAM_LABELS[area], area).toBeDefined()
      expect(programLabel(area)).not.toBe(area)
    }
    expect(programLabel(UNASSIGNED_PROGRAM)).toBe('Unassigned')
  })

  it('falls back to the raw value for a program added later', () => {
    // A new enum member should show up on the chart as itself rather than as
    // "undefined" while somebody gets around to adding a label.
    expect(programLabel('FUTURE_PROGRAM')).toBe('FUTURE_PROGRAM')
  })
})

describe('statusFilter', () => {
  it('counts approved hours only by default', () => {
    expect(statusFilter('approved')).toEqual({ in: ['APPROVED'] })
  })

  it('adds pending — but never rejected — when asked for all', () => {
    expect(statusFilter('all')).toEqual({ in: ['APPROVED', 'PENDING'] })
    expect(statusFilter('all').in).not.toContain('REJECTED')
  })

  it('hands back a fresh mutable array each call', () => {
    // Prisma's generated filter type rejects a readonly tuple, and a shared
    // array would let one handler's `where` mutate another's.
    const first = statusFilter('all')
    first.in.push('REJECTED')
    expect(statusFilter('all').in).toEqual(['APPROVED', 'PENDING'])
  })
})

describe('FULL_TIME_HOURS_PER_YEAR', () => {
  it('is the conventional 2080-hour work year used for FTE', () => {
    expect(FULL_TIME_HOURS_PER_YEAR).toBe(2080)
    expect(round(4160 / FULL_TIME_HOURS_PER_YEAR, 2)).toBe(2)
  })
})
