import fs from 'node:fs'
import path from 'node:path'
import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Removes an event image, both the `Event_Asset` row and the file. Staff only.
 *
 * The DB row goes first and the unlink is best-effort (`existsSync` guarded),
 * so a file already missing from disk still clears its record rather than
 * leaving an asset the UI would render as a broken image.
 *
 * The `path.join(eventId, 'images', fileName)` below reconstructs the same
 * `imageUrl` that `upload.post.ts` stored — note that value carries an `images`
 * segment the real on-disk path does not have, which is why the lookup key and
 * `filePath` are built differently.
 */
export default defineEventHandler(async (event) => {
  // Deleting event images is staff-only.
  await requireRole(event, 'admin')

  const fileName = getRouterParam(event, 'name')
  const eventId = getRouterParam(event, 'id')

  if (!fileName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fileName' })
  }

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing eventId' })
  }

  // imageUrl stored in DB is just the fileName
  const imageUrl = path.join(eventId, 'images', fileName)

  // Check the asset exists in DB
  const asset = await prisma.event_Asset.findUnique({
    where: {
      eventId_imageUrl: {
        eventId,
        imageUrl,
      },
    },
  })

  if (!asset) {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }

  // Delete from DB
  await prisma.event_Asset.delete({
    where: {
      eventId_imageUrl: {
        eventId,
        imageUrl,
      },
    },
  })

  // Delete file from disk
  const storageRoot = path.resolve(process.cwd(), process.env.IMAGE_STORAGE_PATH || 'public/images')
  const filePath = path.join(storageRoot, eventId, decodeURIComponent(fileName))

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  return { message: 'Image deleted successfully' }
})
