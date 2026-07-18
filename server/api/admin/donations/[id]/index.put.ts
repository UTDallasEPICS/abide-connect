import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'admin');
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid fund ID',
    })
  }

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
})
