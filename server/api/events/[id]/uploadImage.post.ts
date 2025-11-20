import path from 'path'
import fs from 'fs'
import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const form = await readMultipartFormData(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing event ID' })
  }

  if (!form) {
    throw createError({ statusCode: 400, statusMessage: "No form data" })
  }

  const file = form.find(i => i.name === "file")

  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: "File missing" })
  }

  const foundEvent = await prisma.event.findUnique({
    where: { id },
    include: { eventAssets: true },
  })

  if (!foundEvent) {
    throw createError({ statusCode: 404, message: 'Event not found' })
  }

  // Save file to /public/uploads

  
  const dirPath = path.join(process.env.IMAGE_STORAGE_PATH || "/public/images", id)

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const filePath = path.join(dirPath, file.filename || "failed.png")

  if (fs.existsSync(filePath)) {
    throw createError({ statusCode: 400, message: 'Image already exists.' })
  }

  fs.writeFileSync(filePath, file.data)

  const addedImage = await prisma.event.update({
    where: {
      id: id,
    },
    data: {
      eventAssets: {
        create: [{
          imageUrl: path.join(id, file.filename || "failed.png")
        }]
      }
    }
  })

  console.log(addedImage)

  setResponseStatus(event, 201);

  return {
    message: "Added file to event."
  }
})
