/**
 * Precision rules for volunteer hour figures.
 *
 * `Volunteer_Hour_Log.hours` is a `Float`, and the two sources that fill it
 * both produce more precision than anyone wants to read: a 50-minute time
 * block works out to 0.8333333333333334, and a volunteer typing into a plain
 * number input can submit 3.14159. Summing those then compounds it — three
 * 4.1-hour logs add up to 12.299999999999999.
 *
 * So every value is rounded to hundredths of an hour (0.01h = 36 seconds),
 * which is finer than anyone logs and still prints cleanly.
 *
 * This lives in `shared/` because both sides need it: the API rounds on write
 * so what's stored is what's shown, and the client rounds totals it computes
 * from rows it fetched.
 */

/** Hundredths of an hour — fine enough for a quarter-hour, short of float noise. */
const HOURS_PRECISION = 2
const HOURS_SCALE = 10 ** HOURS_PRECISION

/**
 * Rounds an hour figure to two decimal places, half away from zero.
 *
 * The `Number.EPSILON` nudge is what makes 1.005 round to 1.01 rather than
 * 1.00 — it's stored as 1.00499999999999989, so a plain `Math.round` sees a
 * value just under the midpoint.
 *
 * Non-finite input (`NaN`, `Infinity`, the `undefined` a malformed body can
 * produce) comes back unchanged rather than as `NaN`-by-arithmetic; validating
 * it is the caller's job, and this helper shouldn't disguise bad input as a
 * number.
 */
export function roundHours(value: number): number {
  if (!Number.isFinite(value)) return value

  const scaled = Math.abs(value) * HOURS_SCALE

  return Math.sign(value) * Math.round(scaled + Number.EPSILON * scaled) / HOURS_SCALE
}

/** Sums hour figures, rounding once at the end so the float noise can't accumulate. */
export function sumHours(values: number[]): number {
  return roundHours(values.reduce((total, value) => total + value, 0))
}
