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

  return prisma.donation.delete({
    where: { id },
  })
})
