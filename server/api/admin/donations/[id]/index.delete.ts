import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole';

/**
 * Deletes a donation campaign. Admin only.
 *
 * Only the DB row goes; any uploaded image under
 * `$IMAGE_STORAGE_PATH/donations/<id>/` is left behind on disk.
 */
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
