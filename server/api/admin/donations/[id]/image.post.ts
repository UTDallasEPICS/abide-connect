import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole';

/**
 * Attaches (or replaces) a donation campaign's image. Admin only.
 *
 * Files go to `$IMAGE_STORAGE_PATH/donations/<id>/`, outside the DB and
 * typically outside `public/` — which is why reading one back needs the
 * sibling `image.get.ts` route rather than a static URL.
 *
 * Only the generated filename is stored on the record. It's a `randomUUID`
 * rather than the client's `file.filename` so that an uploaded name can't
 * escape the directory via `../` or collide with an existing file.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const form = await readMultipartFormData(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing donation ID' })
  }

  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'No form data' })
  }

  const file = form.find(i => i.name === 'file')

  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'File missing' })
  }

  const foundDonation = await prisma.donation.findUnique({
    where: { id },
  })

  if (!foundDonation) {
    throw createError({ statusCode: 404, message: 'Donation not found' })
  }

  const dirPath = path.join(process.env.IMAGE_STORAGE_PATH || 'public/images', 'donations', id)

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const ext = path.extname(file.filename || '.png')
  const uniqueFilename = `${randomUUID()}${ext}`
  const filePath = path.join(dirPath, uniqueFilename)

  console.log('filename:', file.filename)
  console.log('ext:', ext)
  console.log('uniqueFilename:', uniqueFilename)
  console.log('saving to:', filePath)

  fs.writeFileSync(filePath, file.data)

  const imageUrl = uniqueFilename

  // Replacing an image leaves the previous file on disk — the record points at
  // the new one, but nothing prunes the old. Worth a cleanup pass if campaigns
  // get re-imaged often.
  await prisma.donation.update({
    where: { id },
    data: { imageUrl },
  })

  setResponseStatus(event, 201)
  return { message: 'Image uploaded.', imageUrl }
})
