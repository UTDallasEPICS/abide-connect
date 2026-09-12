import fs from 'node:fs'
import path from 'node:path'

/**
 * Streams a donation campaign's image off disk.
 *
 * A route rather than a static asset because `IMAGE_STORAGE_PATH` generally
 * points outside `public/` (a mounted volume in the container), so the file
 * isn't reachable by URL. The filename comes from the DB — never from the
 * request — which is what keeps the joined path inside the storage directory.
 *
 * Content-Type is derived from the extension because nothing is persisted
 * about the original upload's MIME type.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing donation ID' })

  const donation = await prisma.donation.findUnique({ where: { id } })
  if (!donation) throw createError({ statusCode: 404, statusMessage: 'Donation not found' })
  if (!donation.imageUrl) throw createError({ statusCode: 404, statusMessage: 'No image found for this donation' })

  const filePath = path.join(
    process.env.IMAGE_STORAGE_PATH || 'public/images',
    'donations',
    id,
    donation.imageUrl,
  )
  console.log('looking for:', filePath)
  console.log('exists:', fs.existsSync(filePath))

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const ext = path.extname(filePath).toLowerCase()
  const mime
    = ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.avif'
              ? 'image/avif'
              : 'application/octet-stream'

  setHeader(event, 'Content-Type', mime)
  return sendStream(event, fs.createReadStream(filePath))
})
