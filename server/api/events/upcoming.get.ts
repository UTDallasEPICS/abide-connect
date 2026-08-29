import { eventDateBadge } from '#shared/utils/eventTime'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 9
  const now = new Date()
  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: now },
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
