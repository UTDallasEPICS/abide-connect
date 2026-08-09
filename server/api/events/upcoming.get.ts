export default defineEventHandler(async (event) => {

  const query = getQuery(event)
  const limit = Number(query.limit) || 9

  const now = new Date()

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: now },
      allowAttendees: true,
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

    return {
      id: e.id,
      title: e.title,
      url: `/events/${e.id}`,
      image: e.eventAssets[0]?.imageUrl ?? '/images/default-event.jpg',
      day: start.getDate().toString().padStart(2, '0'),
      month: start.toLocaleString('en-US', { month: 'short' }),
      location: e.location
        ? [e.location.name, e.location.city].filter(Boolean).join(', ')
        : 'Location TBD',
      going: e.participants.length + e.guestRSVPs.length,
      startTime: e.startTime,
    }
  })
})