import prisma from '#server/utils/prisma'

/**
 * All donation campaigns, newest first, for the /admin/donations table.
 * Admin only — this returns unpublished and expired campaigns too.
 *
 * Note `imageUrl` here is a bare filename, not a URL; render it through
 * `/api/admin/donations/<id>/image`.
 */
export default defineEventHandler(async () => {
  return prisma.donation.findMany({ orderBy: { createdAt: 'desc' } })
})
