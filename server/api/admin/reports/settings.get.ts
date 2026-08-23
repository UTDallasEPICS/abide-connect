import { requireRole } from '#server/utils/requireRole'
import {
  DEFAULT_LAPSE_THRESHOLD_DAYS,
  DEFAULT_VOLUNTEER_HOURLY_RATE,
  getReportingSettings,
} from '#server/utils/appSettings'

/**
 * The reporting settings, plus the built-in defaults so the editor can show
 * what "reset" would go back to. Admin only.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  return {
    ...await getReportingSettings(),
    defaults: {
      volunteerHourlyRate: DEFAULT_VOLUNTEER_HOURLY_RATE,
      lapseThresholdDays: DEFAULT_LAPSE_THRESHOLD_DAYS,
    },
  }
})
