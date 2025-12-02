import fs from 'node:fs'
import path from 'node:path'

export default defineEventHandler(async (event) => {
  const fileName = getRouterParam(event, 'name')
  const eventID = getRouterParam(event, 'id')

  if (!fileName) {
    throw createError({ statusCode: 400, statusMessage: "Missing fileName" })
  }

  if(!eventID) {
    throw createError({ statusCode: 400, statusMessage: "Missing eventID" })
  }

  // Example: serve from disk *outside* project
  const filePath = path.join(process.env.IMAGE_STORAGE_PATH || "images", eventID, fileName)

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: "File not found" })
  }

  const fileStream = fs.createReadStream(filePath)

  // Set content type based on file extension
  const ext = path.extname(filePath).toLowerCase()

  const mime =
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".gif" ? "image/gif" :
    "application/octet-stream"

  setHeader(event, "Content-Type", mime)

  return sendStream(event, fileStream)
})