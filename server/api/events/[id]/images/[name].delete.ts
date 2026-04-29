import fs from 'node:fs'
import path from 'node:path'
import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const fileName = getRouterParam(event, 'name')
  const eventId = getRouterParam(event, 'id')

  if (!fileName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fileName' })
  }

  if (!eventId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing eventId' })
  }

  // imageUrl stored in DB is just the fileName
  const imageUrl = decodeURIComponent(fileName)

  // Check the asset exists in DB
  const asset = await prisma.event_Asset.findUnique({
    where: {
      eventId_imageUrl: {
        eventId,
        imageUrl,
      }
    }
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
      }
    }
  })

  // Delete file from disk
  const storageRoot = path.resolve(process.cwd(), process.env.IMAGE_STORAGE_PATH || 'public/images')
  const filePath = path.join(storageRoot, eventId, decodeURIComponent(fileName))

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  return { message: 'Image deleted successfully' }
})