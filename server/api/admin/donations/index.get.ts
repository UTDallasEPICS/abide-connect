import prisma from '#server/utils/prisma'

import { requireRole } from '~~/server/utils/requireRole';

export default defineEventHandler(async (event) => {
  return prisma.donation.findMany({ orderBy: { createdAt: 'desc' } })
})
