import path from 'path'
import fs from 'fs'
import prisma from '~~/server/utils/prisma'

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

  const dirPath = path.join(process.env.IMAGE_STORAGE_PATH || 'public/images', id)

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const filePath = path.join(dirPath, decodeURIComponent(file.filename || 'image.png'))

  if (fs.existsSync(filePath)) {
    throw createError({ statusCode: 400, message: 'Image already exists.' })
  }

  fs.writeFileSync(filePath, file.data)

  const imageUrl = path.join(id, file.filename || 'image.png')

  await prisma.donation.update({
    where: { id },
    data: { imageUrl },
  })

  setResponseStatus(event, 201)
  return { message: 'Image uploaded.', imageUrl }
})