import { describe, expect, it } from 'vitest'
import {
  areaPath,
  axisTicks,
  columnPath,
  formatCompact,
  formatCurrency,
  formatHours,
  formatIsoDate,
  formatPercent,
  labelStride,
  linePath,
  niceMax,
  rampIndex,
  scaleY,
  shouldLabel,
} from '~/lib/chart'

/**
 * The scale and formatting maths behind the hand-drawn SVG charts.
 *
 * These are pure functions that decide what a reader sees, so the assertions
 * are about what the chart *claims*: an axis that tops out below the data would
 * clip a bar, a y-scale that inverts would draw growth as decline, and a
 * currency formatter that drops a digit misstates an in-kind total.
 */

describe('niceMax', () => {
  it('rounds up to a readable axis top without wasting the card', () => {
    // The reason for the fine-grained ladder: a coarse 1/2/5/10 one would send
    // 109 to 200 and draw the tallest bar at half height.
    expect(niceMax(109)).toBe(120)
    expect(niceMax(1)).toBe(1)
    expect(niceMax(23)).toBe(25)
    expect(niceMax(41)).toBe(50)
    expect(niceMax(1234)).toBe(1600)
  })

  it('never returns a top below the value it was given', () => {
    for (const value of [0.4, 1, 7, 42, 99, 100, 101, 999, 1000, 8888, 123_456]) {
      expect(niceMax(value), String(value)).toBeGreaterThanOrEqual(value)
    }
  })

  it('falls back to 1 for an empty or nonsensical dataset', () => {
    // A zero-height axis would make every division a divide-by-zero downstream.
    expect(niceMax(0)).toBe(1)
    expect(niceMax(-5)).toBe(1)
    expect(niceMax(Number.NaN)).toBe(1)
    expect(niceMax(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('axisTicks', () => {
  it('spans zero to a nice top with the requested number of intervals', () => {
    expect(axisTicks(100, 4)).toEqual([0, 25, 50, 75, 100])
    expect(axisTicks(100, 2)).toEqual([0, 50, 100])
  })

  it('covers the data — the top tick is never below the maximum', () => {
    for (const max of [1, 3, 17, 109, 640, 5001]) {
      expect(axisTicks(max).at(-1)!, String(max)).toBeGreaterThanOrEqual(max)
      expect(axisTicks(max)[0]).toBe(0)
    }
  })

  it('keeps a headcount axis on whole people', () => {
    // "3.3 volunteers" is not a quantity, so integerOnly picks an interval
    // count that divides the top cleanly instead of forcing the requested one.
    for (const volunteers of [1, 2, 3, 5, 6, 7, 9, 12, 40]) {
      const ticks = axisTicks(volunteers, 4, true)
      expect(ticks.every(Number.isInteger), `max ${volunteers} → ${ticks}`).toBe(true)
      expect(ticks.at(-1)!).toBeGreaterThanOrEqual(volunteers)
    }
  })
})

describe('scaleY', () => {
  it('puts zero on the baseline and the maximum at the top', () => {
    expect(scaleY(0, 100, 10, 200)).toBe(210)
    expect(scaleY(100, 100, 10, 200)).toBe(10)
    expect(scaleY(50, 100, 10, 200)).toBe(110)
  })

  it('is monotonic — a larger value never plots lower', () => {
    let previous = Number.POSITIVE_INFINITY
    for (const value of [0, 1, 5, 25, 60, 99, 100]) {
      const y = scaleY(value, 100, 0, 100)
      expect(y).toBeLessThanOrEqual(previous)
      previous = y
    }
  })

  it('clamps an out-of-domain value to the plot area instead of drawing above it', () => {
    expect(scaleY(500, 100, 10, 200)).toBe(10)
  })

  it('collapses to the baseline when there is nothing to scale against', () => {
    expect(scaleY(5, 0, 10, 200)).toBe(210)
  })
})

describe('paths', () => {
  it('draws a polyline through the points, in order', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 2.5 }, { x: 10, y: 0 }]))
      .toBe('M0.00,10.00 L5.00,2.50 L10.00,0.00')
  })

  it('emits nothing for an empty series rather than a stray marker', () => {
    expect(linePath([])).toBe('')
    expect(areaPath([], 100)).toBe('')
  })

  it('closes an area down to the baseline at both ends', () => {
    const area = areaPath([{ x: 0, y: 10 }, { x: 10, y: 0 }], 50)
    expect(area).toBe('M0.00,10.00 L10.00,0.00 L10.00,50.00 L0.00,50.00 Z')
    expect(area.endsWith('Z')).toBe(true)
  })

  it('rounds only the top corners of a column', () => {
    const path = columnPath(0, 100, 20, 50, 4)
    // Starts at the baseline (y + height), arcs across the top, closes flat.
    expect(path.startsWith('M0,150')).toBe(true)
    expect(path).toContain('a4,4')
    expect(path.endsWith('V150 Z')).toBe(true)
  })

  it('draws a stub bar square rather than bowing its own top edge', () => {
    expect(columnPath(0, 100, 20, 0.4, 4)).toBe('M0,100 h20 v0.4 h-20 Z')
  })

  it('draws nothing for a zero-height column', () => {
    expect(columnPath(0, 100, 20, 0)).toBe('')
    expect(columnPath(0, 100, 20, -3)).toBe('')
  })
})

describe('axis label thinning', () => {
  it('keeps every label when they already fit', () => {
    expect(labelStride(6, 12)).toBe(1)
  })

  it('thins to at most the requested count', () => {
    const stride = labelStride(365, 12)
    const kept = Array.from({ length: 365 }, (_, i) => shouldLabel(i, 365, stride))
      .filter(Boolean).length
    expect(kept).toBeLessThanOrEqual(12)
    expect(stride).toBe(31)
  })

  it('always labels the most recent period', () => {
    // The reader looks at the right-hand end first; an unlabelled last tick is
    // the one that actually costs them.
    for (const count of [7, 12, 31, 52, 365]) {
      const stride = labelStride(count, 8)
      expect(shouldLabel(count - 1, count, stride), `count ${count}`).toBe(true)
    }
  })
})

describe('number formatting', () => {
  it('keeps four-digit values readable in full', () => {
    expect(formatCompact(1284)).toBe('1,284')
    expect(formatCompact(9999)).toBe('9,999')
  })

  it('compacts only once the digits stop fitting on an axis', () => {
    expect(formatCompact(10_000)).toBe('10K')
    expect(formatCompact(12_900)).toBe('12.9K')
    expect(formatCompact(2_500_000)).toBe('2.5M')
    expect(formatCompact(1_000_000)).toBe('1M')
  })

  it('shows a fractional hour below 10 but not above it', () => {
    expect(formatCompact(2.5)).toBe('2.5')
    expect(formatCompact(42.7)).toBe('43')
  })

  it('pluralises hours on the value, not on the rendering', () => {
    expect(formatHours(1)).toBe('1 hr')
    expect(formatHours(0)).toBe('0 hrs')
    expect(formatHours(2.5)).toBe('2.5 hrs')
    expect(formatHours(1284)).toBe('1,284 hrs')
  })

  it('formats currency to the cent below a thousand and to the dollar above', () => {
    expect(formatCurrency(34.79)).toBe('$34.79')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(1234.56)).toBe('$1,235')
  })

  it('compacts a headline dollar figure only when asked', () => {
    expect(formatCurrency(48_706, true)).toBe('$48.7K')
    expect(formatCurrency(48_706)).toBe('$48,706')
    // Below the threshold, `compact` changes nothing.
    expect(formatCurrency(9999, true)).toBe('$9,999')
  })

  it('formats percentages at the requested precision', () => {
    expect(formatPercent(52.6)).toBe('53%')
    expect(formatPercent(52.64, 1)).toBe('52.6%')
    expect(formatPercent(-12)).toBe('-12%')
  })

  it('formats an ISO instant in the report timezone, not the host one', () => {
    // 03:00 UTC on Aug 18 is still Aug 17 in Chicago. The process runs in UTC.
    expect(formatIsoDate('2026-08-18T03:00:00Z')).toBe('Aug 17, 2026')
    expect(formatIsoDate('2026-01-01T05:30:00Z')).toBe('Dec 31, 2025')
  })
})

describe('rampIndex', () => {
  it('reserves step 0 for genuinely empty cells', () => {
    // On a coverage grid the difference between "no shift" and "a thin shift"
    // is the whole point, so anything above zero gets at least step 1.
    expect(rampIndex(0, 100)).toBe(0)
    expect(rampIndex(0.25, 100)).toBe(1)
  })

  it('tops out at the last step for the busiest cell', () => {
    expect(rampIndex(100, 100)).toBe(6)
    expect(rampIndex(150, 100)).toBe(6)
  })

  it('uses a square-root scale so one big event does not flatten the grid', () => {
    const linear = (value: number, max: number, steps = 7) =>
      Math.round((value / max) * (steps - 1))

    // No cell reads paler than a linear ramp would paint it, and the quiet end
    // — where a linear scale washes everything out once one big event sets the
    // maximum — reads distinctly darker.
    for (const value of [10, 25, 50, 75, 90]) {
      expect(rampIndex(value, 100), `${value}%`).toBeGreaterThanOrEqual(linear(value, 100))
    }
    for (const value of [10, 25, 50]) {
      expect(rampIndex(value, 100), `${value}%`).toBeGreaterThan(linear(value, 100))
    }
    expect(rampIndex(25, 100)).toBe(3)
    expect(rampIndex(50, 100)).toBe(4)
  })

  it('stays in range for a degenerate maximum', () => {
    expect(rampIndex(5, 0)).toBe(0)
    expect(rampIndex(-1, 100)).toBe(0)
  })
})
