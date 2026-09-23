/**
 * Scales, ticks and number formatting for the hand-drawn SVG charts on
 * `/admin/reports`.
 *
 * No charting library: the app ships to volunteers on phones over patchy
 * connections, and none of these charts needs more than a scale and a path.
 * Everything here is pure so the charts render identically on the server and
 * the client — a chart that only appears after hydration is a blank card on the
 * first paint.
 */
import { ORG_TIME_ZONE } from '#shared/utils/timeZone'
import { formatShortDate } from '#shared/utils/eventTime'

/**
 * Rounds a maximum up to a readable axis top.
 *
 * The ladder is deliberately fine-grained. A coarse one (1 / 2 / 5 / 10) sends
 * a maximum of 109 all the way to 200, and the chart then draws its tallest
 * mark at half height and wastes the top half of the card — which reads as a
 * decline that isn't in the data.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalised = value / magnitude

  const step = [1, 1.2, 1.6, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .find(candidate => normalised <= candidate) ?? 10

  return step * magnitude
}

/**
 * Evenly spaced tick values from 0 to a nice maximum, inclusive of both ends.
 * `count` is the number of intervals, so 4 yields five labels.
 *
 * `integerOnly` is for axes counting people, where "3.3 volunteers" is not a
 * quantity: it picks the interval count that divides the top cleanly instead of
 * forcing the requested one.
 */
export function axisTicks(max: number, count = 4, integerOnly = false): number[] {
  const top = niceMax(max)
  const steps = integerOnly
    ? [4, 5, 3, 2, 1].find(candidate => Number.isInteger(top / candidate)) ?? 1
    : count

  return Array.from({ length: steps + 1 }, (_, index) => (top / steps) * index)
}

/** Maps a value in [0, domainMax] to a pixel position on an inverted y-axis. */
export function scaleY(value: number, domainMax: number, top: number, height: number): number {
  if (domainMax <= 0) return top + height
  return top + height - (Math.min(value, domainMax) / domainMax) * height
}

/**
 * `M x,y L x,y …` through the given points. Straight segments on purpose —
 * a smoothed curve on monthly volunteer hours implies values between the
 * months that were never measured.
 */
export function linePath(points: { x: number, y: number }[]): string {
  if (points.length === 0) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ')
}

/** The same path closed down to the baseline, for the area wash under a line. */
export function areaPath(points: { x: number, y: number }[], baseline: number): string {
  if (points.length === 0) return ''
  const first = points[0]!
  const last = points[points.length - 1]!
  return `${linePath(points)} L${last.x.toFixed(2)},${baseline.toFixed(2)} `
    + `L${first.x.toFixed(2)},${baseline.toFixed(2)} Z`
}

/**
 * A rectangle with its top corners rounded and its baseline square, as the
 * column spec calls for. Falls back to a plain rect when the bar is shorter
 * than the corner radius, where an arc would bow the bar's own top edge.
 */
export function columnPath(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.min(radius, width / 2, Math.max(0, height))
  if (height <= 0) return ''
  if (r <= 0.5) return `M${x},${y} h${width} v${height} h${-width} Z`

  return `M${x},${y + height} V${y + r} a${r},${r} 0 0 1 ${r},${-r} `
    + `h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${y + height} Z`
}

/** Thins axis labels to roughly `max` of them, always keeping the last one. */
export function labelStride(count: number, max: number): number {
  return Math.max(1, Math.ceil(count / max))
}

export function shouldLabel(index: number, count: number, stride: number): boolean {
  // Anchor on the final tick and step backwards, so the most recent period is
  // always labelled — it is the one a reader looks for first.
  return (count - 1 - index) % stride === 0
}

/** "1,284" / "12.9K" — compact only once the digits stop fitting on an axis. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return value.toLocaleString('en-US', { maximumFractionDigits: abs < 10 ? 1 : 0 })
}

export function formatHours(value: number): string {
  return `${formatCompact(value)} ${value === 1 ? 'hr' : 'hrs'}`
}

export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 10_000) {
    return `$${formatCompact(value)}`
  }
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  })
}

export function formatPercent(value: number, places = 0): string {
  return `${value.toFixed(places)}%`
}

/** "Aug 13, 2026" from an ISO string, in the org's timezone like everything else. */
export function formatIsoDate(iso: string, timeZone = ORG_TIME_ZONE): string {
  return formatShortDate(new Date(iso), timeZone)
}

/**
 * Picks a step from a 7-stop sequential ramp for a value in [0, max].
 *
 * Zero gets step 0 — a cell with nothing in it must read as empty rather than
 * as "a little", which on a coverage grid is the difference between a gap and a
 * thin shift. Above zero the scale is square-root rather than linear, because
 * one big event otherwise flattens every other cell to the palest step.
 */
export function rampIndex(value: number, max: number, steps = 7): number {
  if (value <= 0 || max <= 0) return 0
  const fraction = Math.sqrt(value / max)
  return Math.min(steps - 1, Math.max(1, Math.round(fraction * (steps - 1))))
}
