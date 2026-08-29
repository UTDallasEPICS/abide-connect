import { zonedDayBounds, zonedDayBoundsForDate } from '#shared/utils/eventTime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const dateParam = typeof query.date === 'string' ? query.date : undefined

  // Expects YYYY-MM-DD. Falls back to today if missing or malformed, so the
  // endpoint never 500s on a bad/absent query param.
  const isValidDateString = dateParam ? /^\d{4}-\d{2}-\d{2}$/.test(dateParam) : false

  // The day is a Central day, like every other date this app shows. Production
  // runs the server in UTC, where "today" starts at 7pm the evening before and
  // an evening event lands on the wrong date.
  const { start: dayStart, end: dayEnd } = isValidDateString
    ? zonedDayBoundsForDate(dateParam!)
    : zonedDayBounds(new Date())

  if (Number.isNaN(dayStart.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
  }

  const events = await prisma.event.findMany({
    where: {
      // Overlaps the day rather than strictly starting in it, so a
      // multi-day event still shows up on every day it spans.
      startTime: { lte: dayEnd },
      endTime: { gte: dayStart },
      allowAttendees: true,
      isTraining: false,
    },
    orderBy: { startTime: 'asc' },
    include: {
      location: true,
      eventAssets: true,
    },
  })

  return events.map((e) => {
    const asset = e.eventAssets[0]
    const image = asset
      ? `/api/events/${e.id}/images/${asset.imageUrl.split('/').pop()}`
      : '/images/default-event.jpg'
    return {
      id: e.id,
      title: e.title,
      url: `/events/${e.id}`,
      image,
      startTime: e.startTime,
      location: e.location.address,
    }
  })
})
