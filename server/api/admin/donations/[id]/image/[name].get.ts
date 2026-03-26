import fs from 'node:fs'
import path from 'node:path'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')
  const id = getRouterParam(event, 'id')

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing fileName' })
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing donation ID' })

  const filePath = path.join(
    process.env.IMAGE_STORAGE_PATH || 'public/images',
    id,
    name
  )

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const ext = path.extname(filePath).toLowerCase()
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    'application/octet-stream'

  setHeader(event, 'Content-Type', mime)
  return sendStream(event, fs.createReadStream(filePath))
})