import { requireRole } from '#server/utils/requireRole'
import { getReportingSettings, saveReportingSettings } from '#server/utils/appSettings'

/**
 * Updates the reporting settings — chiefly the volunteer hourly rate, which
 * Independent Sector republishes every year. Admin only.
 *
 * The bounds are sanity rails, not policy: a rate is a dollars-per-hour figure
 * in the tens, and a typo'd `3479` would quietly multiply every in-kind total
 * on a grant report by a hundred.
 */
export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'admin')

  const body = await readBody<{
    volunteerHourlyRate?: number | string
    volunteerHourlyRateSource?: string
    lapseThresholdDays?: number | string
  }>(event)

  const updates: Partial<Record<'volunteerHourlyRate' | 'volunteerHourlyRateSource' | 'lapseThresholdDays', string>> = {}

  if (body.volunteerHourlyRate !== undefined) {
    const rate = Number(body.volunteerHourlyRate)
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The volunteer hourly rate must be a number between 0 and 1000.',
      })
    }
    updates.volunteerHourlyRate = String(Math.round(rate * 100) / 100)
  }

  if (body.volunteerHourlyRateSource !== undefined) {
    const source = String(body.volunteerHourlyRateSource).trim()
    if (source.length > 200) {
      throw createError({ statusCode: 400, statusMessage: 'The rate source is too long.' })
    }
    updates.volunteerHourlyRateSource = source
  }

  if (body.lapseThresholdDays !== undefined) {
    const days = Number(body.lapseThresholdDays)
    if (!Number.isInteger(days) || days < 7 || days > 730) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The lapse threshold must be a whole number of days between 7 and 730.',
      })
    }
    updates.lapseThresholdDays = String(days)
  }

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update.' })
  }

  await saveReportingSettings(updates, session.user.id)

  return getReportingSettings()
})
