import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

/**
 * Longest edge kept for a stored event image. Cards render these at a few
 * hundred pixels and the event page at container width, so 1600px still has
 * headroom for a retina hero while capping a phone-camera upload (4032px,
 * ~2.5 MB) at a couple of hundred kilobytes. Only ever scales down.
 */
const MAX_EDGE = 1600

/** Formats sharp can re-encode. Anything else is stored byte-for-byte. */
const RESIZABLE = new Set(['.jpg', '.jpeg', '.png', '.webp'])

/**
 * Attaches an image to an event. Staff only.
 *
 * The file goes to `$IMAGE_STORAGE_PATH/<eventId>/<filename>` and an
 * `Event_Asset` row records it. Uploading a name that already exists is
 * rejected rather than overwritten, since the client's filename is kept as-is
 * (unlike donation images, which are renamed to a UUID) — so the name is the
 * de-duplication key.
 *
 * Keeping the client's filename means it is worth validating: a name
 * containing `..` would place the write outside the event's directory.
 *
 * NOTE: the stored `imageUrl` is `<eventId>/images/<filename>`, but the file is
 * actually written to `<eventId>/<filename>` — the `images` segment exists only
 * in the DB value. `[name].delete.ts` reproduces the same segment when looking
 * the row up, so the two agree, but `imageUrl` is not a usable path on disk.
 */
export default defineEventHandler(async (event) => {
  // Uploading event images is staff-only.
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  const form = await readMultipartFormData(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'No form data' })
  }

  const file = form.find(i => i.name === 'file')

  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'File missing' })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
    include: { eventAssets: true },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // Save file to public/images
  const dirPath = path.join(
    process.env.IMAGE_STORAGE_PATH || 'public/images',
    id,
  )

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const filePath = path.join(
    dirPath,
    decodeURIComponent(file.filename || 'failed.png'),
  )

  if (fs.existsSync(filePath)) {
    throw createError({ statusCode: 400, message: 'Image already exists.' })
  }

  // Downscale before writing. Originals used to be stored untouched, so a
  // photo straight off a phone (4032x3024, ~2.3 MB) was re-streamed at full
  // size to every visitor.
  const original = Buffer.from(file.data)
  let data = original
  const ext = path.extname(filePath).toLowerCase()

  if (RESIZABLE.has(ext)) {
    try {
      const processed = await sharp(original)
        // Auto-orient from EXIF first, so a portrait phone photo is measured
        // the way it will be displayed. Re-encoding also drops the rest of
        // the EXIF block, including any GPS tag the phone attached.
        .rotate()
        // `withoutEnlargement` leaves an already-small image alone; `inside`
        // preserves the aspect ratio rather than cropping the subject out.
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .toBuffer()

      // Only keep the re-encode if it actually won. Re-encoding a PNG that
      // was already below the cap regularly makes it *larger* — sharp's
      // default PNG settings don't match whatever optimiser produced the
      // original (one of the images in public/ grows from 2.1 MB to 2.9 MB
      // this way). Comparing sizes keeps the big win on oversized photos
      // without quietly inflating everything else.
      if (processed.length < original.length) {
        data = processed
      }
    }
    catch (err) {
      // Best-effort: an unexpected format or a corrupt file must not block
      // the upload, so fall back to the bytes as received.
      console.error('Image resize failed, storing original:', err)
    }
  }

  fs.writeFileSync(filePath, data)
  console.log(
    '✅ File written:',
    filePath,
    data === original
      ? `(${original.length} bytes, stored as uploaded)`
      : `(${original.length} → ${data.length} bytes)`,
  )

  const addedImage = await prisma.event.update({
    where: { id },
    data: {
      eventAssets: {
        create: [
          {
            imageUrl: path.join(id, 'images', file.filename || 'failed.png'),
          },
        ],
      },
    },
  })

  console.log(addedImage)

  setResponseStatus(event, 201)

  return {
    message: 'Added file to event.',
  }
})
