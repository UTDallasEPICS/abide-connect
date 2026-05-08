import prisma from "~~/server/utils/prisma"
import { auth } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    })
  }

  const certificates = await prisma.trainingCertificate.findMany()

  return certificates
})