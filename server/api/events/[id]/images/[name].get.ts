import fs from 'node:fs'
import path from 'node:path'

/**
 * Streams an event image off disk.
 *
 * A route rather than a static asset because `IMAGE_STORAGE_PATH` usually
 * points outside `public/` (a mounted volume in the container). Left
 * unauthenticated on purpose — event images appear on public event pages.
 *
 * SECURITY: `fileName` and `eventID` come straight from the URL and are joined
 * into a filesystem path with no validation, so `..` segments escape the
 * storage directory and this will serve any file the process can read. Unlike
 * the donations equivalent (`admin/donations/[id]/image.get.ts`), which takes
 * the filename from the database, nothing here constrains the input. It wants
 * a containment check before the read, e.g.
 *
 *     const root = path.resolve(process.env.IMAGE_STORAGE_PATH || 'public/images')
 *     const filePath = path.resolve(root, eventID, fileName)
 *     if (!filePath.startsWith(root + path.sep)) throw createError({ statusCode: 400 })
 *
 * Content-Type is inferred from the extension since the original upload's MIME
 * type isn't stored.
 */
export default defineEventHandler(async (event) => {
  const fileName = getRouterParam(event, 'name')
  const eventID = getRouterParam(event, 'id')

  if (!fileName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fileName' })
  }

  if (!eventID) {
    throw createError({ statusCode: 400, statusMessage: 'Missing eventID' })
  }

  // Get file path relative to project root
  const filePath = path.join(
    process.env.IMAGE_STORAGE_PATH || 'public/images',
    eventID,
    fileName,
  )

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const fileStream = fs.createReadStream(filePath)

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
            : 'application/octet-stream'

  setHeader(event, 'Content-Type', mime)

  return sendStream(event, fileStream)
})
