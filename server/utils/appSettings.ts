import prisma from '#server/utils/prisma'

/**
 * Typed access to the `AppSetting` key/value table.
 *
 * Only this module reads or writes that table — `value` is a raw string there,
 * and letting each caller parse it is how a report ends up multiplying hours by
 * `"34.79 "` and rendering NaN. Every getter returns a usable value whether or
 * not a row exists, so nothing has to seed the table before the first report.
 */

export const SETTING_KEYS = {
  /** Dollars per volunteer hour, for the in-kind value on the funder report. */
  volunteerHourlyRate: 'reporting.volunteerHourlyRate',
  /** Where that figure came from, cited under the number on the report. */
  volunteerHourlyRateSource: 'reporting.volunteerHourlyRateSource',
  /** Days of silence before an active volunteer is called at risk of lapsing. */
  lapseThresholdDays: 'reporting.lapseThresholdDays',
} as const

/**
 * Independent Sector's published value of a volunteer hour. It is reissued
 * every year, which is exactly why it's a setting and not a constant — this
 * default is only the starting point for a fresh install, and a grant report
 * run in a later year should be using the rate staff entered, not this.
 */
export const DEFAULT_VOLUNTEER_HOURLY_RATE = 34.79
export const DEFAULT_VOLUNTEER_HOURLY_RATE_SOURCE = 'Independent Sector, value of volunteer time'
export const DEFAULT_LAPSE_THRESHOLD_DAYS = 60

export interface ReportingSettings {
  volunteerHourlyRate: number
  volunteerHourlyRateSource: string
  lapseThresholdDays: number
  /** True while every field is still the built-in default — the funder report
   *  warns on this, since an unreviewed rate on a grant report is a real risk. */
  usingDefaults: boolean
  updatedAt: string | null
}

export async function getReportingSettings(): Promise<ReportingSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  })
  const byKey = new Map(rows.map(row => [row.key, row]))

  const rawRate = byKey.get(SETTING_KEYS.volunteerHourlyRate)?.value
  const parsedRate = rawRate === undefined ? Number.NaN : Number.parseFloat(rawRate)
  const rawLapse = byKey.get(SETTING_KEYS.lapseThresholdDays)?.value
  const parsedLapse = rawLapse === undefined ? Number.NaN : Number.parseInt(rawLapse, 10)

  const updatedAt = rows
    .map(row => row.updatedAt.getTime())
    .sort((a, b) => b - a)[0]

  return {
    // A stored-but-unparseable value falls back rather than propagating NaN
    // into every dollar figure on the page.
    volunteerHourlyRate: Number.isFinite(parsedRate) && parsedRate > 0
      ? parsedRate
      : DEFAULT_VOLUNTEER_HOURLY_RATE,
    volunteerHourlyRateSource: byKey.get(SETTING_KEYS.volunteerHourlyRateSource)?.value
      || DEFAULT_VOLUNTEER_HOURLY_RATE_SOURCE,
    lapseThresholdDays: Number.isFinite(parsedLapse) && parsedLapse > 0
      ? parsedLapse
      : DEFAULT_LAPSE_THRESHOLD_DAYS,
    usingDefaults: rows.length === 0,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
  }
}

/** Upserts only the keys present, so saving the rate can't blank the source. */
export async function saveReportingSettings(
  values: Partial<Record<keyof typeof SETTING_KEYS, string>>,
  updatedByUserId: string,
): Promise<void> {
  const writes = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => {
      const key = SETTING_KEYS[name as keyof typeof SETTING_KEYS]
      return prisma.appSetting.upsert({
        where: { key },
        create: { key, value: value!, updatedByUserId },
        update: { value: value!, updatedByUserId },
      })
    })

  await prisma.$transaction(writes)
}
