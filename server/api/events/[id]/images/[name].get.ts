import fs from 'node:fs'
import path from 'node:path'

export default defineEventHandler(async (event) => {
  const fileName = getRouterParam(event, 'name')
  const eventID = getRouterParam(event, 'id')

  if (!fileName) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fileName' })
  }

  if (!eventID) {
    throw createError({ statusCode: 400, statusMessage: 'Missing eventID' })
  }

  const storageRoot = path.resolve(process.cwd(), process.env.IMAGE_STORAGE_PATH || 'public/images')
  const filePath = path.join(storageRoot, eventID, decodeURIComponent(fileName))

  console.log('🖼 Serving image from:', filePath)
  console.log('📂 File exists:', fs.existsSync(filePath))

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const fileStream = fs.createReadStream(filePath)

  const ext = path.extname(filePath).toLowerCase()
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    'application/octet-stream'

  setHeader(event, 'Content-Type', mime)

  return sendStream(event, fileStream)
})