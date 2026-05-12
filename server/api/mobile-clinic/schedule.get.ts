import prisma from '~~/server/utils/prisma'

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
const MAX_OCCURRENCES = 8
const LOOKAHEAD_WEEKS = 4

const addWeeks = (date: Date, weeks: number) =>
  new Date(date.getTime() + weeks * MS_PER_WEEK)

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
