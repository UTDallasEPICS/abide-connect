import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole';

/**
 * Creates a donation campaign. Admin only.
 *
 * The image is deliberately not part of this request: `imageUrl` starts empty
 * and is filled in by a follow-up POST to `<id>/image`, because the upload
 * needs the record's id to derive its storage directory. A campaign is
 * therefore imageless between the two calls, which the admin UI has to expect.
 */
export default defineEventHandler(async (event) => {
  const session = await requireRole(event, 'admin');
  const body = await readBody(event)

  return prisma.donation.create({
    data: {
      name: body.name,
      link: body.link,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      imageUrl: '',
    },
  })
})
