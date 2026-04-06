import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
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

  await prisma.donation.update({
    where: { id },
    data: { imageUrl },
  })

  setResponseStatus(event, 201)
  return { message: 'Image uploaded.', imageUrl }
})