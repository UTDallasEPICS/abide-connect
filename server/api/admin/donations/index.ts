import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') {
    return prisma.donation.findMany({ orderBy: { createdAt: 'desc' } })
  }

  if (event.method === 'POST') {
    const body = await readBody(event)
    return prisma.donation.create({
      data: {
        name: body.name,
        link: body.link,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        imageUrl: body.imageUrl ?? '',
      },
    })
  }
})