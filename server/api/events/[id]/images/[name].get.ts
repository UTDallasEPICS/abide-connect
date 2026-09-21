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
 *
 * CACHING: every one of these was previously re-downloaded and re-streamed
 * through Node on every page view, which is this app's hottest path. An
 * upload rejects a filename that already exists rather than overwriting it
 * (see `upload.post.ts`), so a given URL's bytes never change — the only way
 * to alter an event's image is to delete the asset and upload a new name.
 * That makes a long `max-age` safe. The ETag is belt-and-braces for the
 * caches that revalidate anyway, and turns a revalidation into a 304 with no
 * body instead of a fresh stream.
 */

/** Weak-ish validator from the file's own metadata: no hashing, one stat call. */
function fileETag(stat: fs.Stats): string {
  return `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`
}

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

  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  if (!stat.isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const etag = fileETag(stat)

  // A week in the browser/PWA cache, with a day of stale-while-revalidate on
  // top so a shared cache can keep serving while it refreshes in the
  // background. Not `immutable`: the containment gap noted above means a
  // filename isn't a guarantee about the bytes, and a week is short enough to
  // recover from a bad upload by hand.
  setHeader(event, 'Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400')
  setHeader(event, 'ETag', etag)
  setHeader(event, 'Last-Modified', stat.mtime.toUTCString())

  // Revalidation with a matching validator: answer with no body at all.
  const ifNoneMatch = getRequestHeader(event, 'if-none-match')
  if (ifNoneMatch && ifNoneMatch.split(',').some(t => t.trim() === etag)) {
    setResponseStatus(event, 304)
    return null
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
            : 'application/octet-stream'

  setHeader(event, 'Content-Type', mime)
  setHeader(event, 'Content-Length', stat.size)

  return sendStream(event, fs.createReadStream(filePath))
})
