import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async () => {
  return prisma.donation.findMany({ orderBy: { createdAt: 'desc' } })
})