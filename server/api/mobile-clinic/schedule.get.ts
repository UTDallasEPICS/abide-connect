import prisma from '#server/utils/prisma'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
const MAX_OCCURRENCES = 8
const LOOKAHEAD_WEEKS = 4

// Adds whole weeks as fixed 7×24h spans. This shifts wall-clock time by an hour
// across a DST boundary — acceptable while the recurrence is display-only, but
// it would need a timezone-aware calculation before these drive reminders.
const addWeeks = (date: Date, weeks: number) =>
  new Date(date.getTime() + weeks * MS_PER_WEEK)

/**
 * Upcoming mobile clinic stops for the public locator map.
 *
 * Intentionally unauthenticated — clinic times and locations are public and the
 * page is reachable without an account.
 *
 * Every `Mobile_Clinic_Schedule` row is treated as an open-ended *weekly*
 * recurrence rather than a single dated stop: the table stores one origin
 * date/time per stop, and this expands it into concrete occurrences for the
 * next `LOOKAHEAD_WEEKS`. That means occurrences are computed, never stored,
 * so the ids below (`<scheduleId>-<n>`) are synthetic and only stable within a
 * single response — don't persist them or use them as links. `scheduleId` is
 * the real row.
 *
 * `MAX_OCCURRENCES` is a belt-and-braces cap so a malformed row (say `endTime`
 * before `startTime`) can't spin the loop.
 */
export default defineEventHandler(async () => {
  try {
    const scheduleEntries = await prisma.mobile_Clinic_Schedule.findMany({
      include: {
        location: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    const now = new Date()
    const windowEnd = addWeeks(now, LOOKAHEAD_WEEKS)

    const occurrences = scheduleEntries.flatMap((entry) => {
      const originStart = new Date(entry.startTime)
      const originEnd = new Date(entry.endTime)
      const occurrencesForEntry: Array<{
        id: string
        scheduleId: string
        startTime: string
        endTime: string
        location: { latitude: number, longitude: number, address: string }
      }> = []
      let startTime = new Date(originStart)
      let endTime = new Date(originEnd)

      // Origin dates are usually in the past, so jump straight to the first
      // occurrence at or after now instead of stepping a week at a time — a
      // stop seeded a year ago would otherwise take ~52 iterations to catch up.
      if (endTime < now) {
        const weeksAhead = Math.ceil(
          (now.getTime() - endTime.getTime()) / MS_PER_WEEK,
        )
        startTime = addWeeks(startTime, weeksAhead)
        endTime = addWeeks(endTime, weeksAhead)
      }

      let count = 0
      while (count < MAX_OCCURRENCES && startTime < windowEnd) {
        if (endTime >= now) {
          occurrencesForEntry.push({
            id: `${entry.id}-${count}`,
            scheduleId: entry.id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            location: entry.location,
          })
          count += 1
        }

        startTime = addWeeks(startTime, 1)
        endTime = addWeeks(endTime, 1)
      }

      return occurrencesForEntry
    })

    console.log(
      `Generated ${occurrences.length} mobile clinic occurrences from ${scheduleEntries.length} schedule entries`,
    )
    return occurrences.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )
  }
  catch (error) {
    console.error('Failed to fetch mobile clinic schedule', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch mobile clinic schedule',
    })
  }
})
