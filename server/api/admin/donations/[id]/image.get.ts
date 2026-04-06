import fs from 'node:fs'
import path from 'node:path'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing donation ID' })

  const donation = await prisma.donation.findUnique({ where: { id } })
  if (!donation) throw createError({ statusCode: 404, statusMessage: 'Donation not found' })
  if (!donation.imageUrl) throw createError({ statusCode: 404, statusMessage: 'No image found for this donation' })

  const filePath = path.join(
    process.env.IMAGE_STORAGE_PATH || 'public/images',
    'donations',
    id,
    donation.imageUrl
  )
console.log('looking for:', filePath)
console.log('exists:', fs.existsSync(filePath))

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const ext = path.extname(filePath).toLowerCase()
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
    ext === '.gif' ? 'image/gif' :
    ext === '.webp' ? 'image/webp' :
    ext === '.avif' ? 'image/avif' :
    'application/octet-stream'

  setHeader(event, 'Content-Type', mime)
  return sendStream(event, fs.createReadStream(filePath))
})