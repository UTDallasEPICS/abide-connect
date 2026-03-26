import prisma from '~~/server/utils/prisma'
import { getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid fund ID',
    })
  }

  if (event.method === 'PUT') {
    const body = await readBody(event)

    return prisma.donation.update({
      where: { id },
      data: {
        name: body.name,
        link: body.link,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        imageUrl: body.imageUrl,
      },
    })
  }

  if (event.method === 'DELETE') {
    return prisma.donation.delete({
      where: { id },
    })
  }
})