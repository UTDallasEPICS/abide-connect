import { eventDateBadge, zonedWeekBounds } from '#shared/utils/eventTime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 20
  const now = new Date()

  // Sunday 00:00 through Saturday 23:59:59.999, read in Central rather than on
  // the host clock (UTC in production, which would shift the week by a night).
  const { start: startOfWeek, end: endOfWeek } = zonedWeekBounds(now)

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: startOfWeek, lte: endOfWeek },
      allowAttendees: true,
      isTraining: false,
    },
    orderBy: { startTime: 'asc' },
    take: limit,
    include: {
      location: true,
      eventAssets: true,
      participants: true,
      guestRSVPs: true,
    },
  })

  return events.map((e) => {
    const badge = eventDateBadge(e.startTime)
    const asset = e.eventAssets[0]
    const image = asset
      ? `/api/events/${e.id}/images/${asset.imageUrl.split('/').pop()}`
      : '/images/default-event.jpg'
    return {
      id: e.id,
      title: e.title,
      url: `/events/${e.id}`,
      image,
      day: badge.day,
      month: badge.month,
      location: e.location.address,
      going: e.participants.length + e.guestRSVPs.length,
      startTime: e.startTime,
    }
  })
})
