import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        eventAssets: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    return events
  } catch (err) {
    console.error('Error fetching events:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch events',
    })
  }
})
