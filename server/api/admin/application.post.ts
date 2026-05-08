import prisma from "~~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  console.log("APPLICATION BODY:", body)

  return await prisma.volunteerApplication.create({
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
    }
  })
})