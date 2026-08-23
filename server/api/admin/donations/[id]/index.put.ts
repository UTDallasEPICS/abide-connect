import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole'

/**
 * Replaces a donation campaign's fields. Admin only.
 *
 * A full replace, not a patch: every field is written from the body, so a
 * caller omitting one clears it. `imageUrl` is expected to be the bare filename
 * previously returned by the `<id>/image` upload — sending something else will
 * point the record at a file that isn't there.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

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
