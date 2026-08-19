export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Number(query.limit) || 20
  const now = new Date()

  // Start of this week (Sunday, local time)
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  // End of this week (Saturday, local time, end of day)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

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