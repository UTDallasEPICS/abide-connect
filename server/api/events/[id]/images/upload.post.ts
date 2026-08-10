import path from 'path'
import fs from 'fs'
import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'

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

  fs.writeFileSync(filePath, file.data)
  console.log('✅ File written:', filePath)

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
