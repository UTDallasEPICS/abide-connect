import prisma from "~~/server/utils/prisma"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  console.log("DELETE HIT", query.id)

  if (!query.id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing ID",
    })
  }

  return await prisma.volunteerApplication.delete({
    where: {
      id: String(query.id),
    },
  })
})