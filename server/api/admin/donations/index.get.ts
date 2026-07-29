import prisma from '#server/utils/prisma'

import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'admin');
  return prisma.donation.findMany({ orderBy: { createdAt: 'desc' } })
})
