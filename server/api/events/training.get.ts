import prisma from '#server/utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 9
  const now = new Date()
  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: now },
      isTraining: true,
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
    const start = new Date(e.startTime)
    const asset = e.eventAssets[0]
    const image = asset
        ? `/api/events/${e.id}/images/${asset.imageUrl.split('/').pop()}`
        : '/images/default-event.jpg'
    return {
      id: e.id,
      title: e.title,
      url: `/events/${e.id}`,
      image,
      day: start.getDate().toString().padStart(2, '0'),
      month: start.toLocaleString('en-US', { month: 'short' }),
      location: e.location.address,
      going: e.participants.length + e.guestRSVPs.length,
      startTime: e.startTime,
    }
  })
})