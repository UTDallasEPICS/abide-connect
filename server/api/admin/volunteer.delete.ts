import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  return await prisma.volunteer.delete({
    where: { id: body.id }
  })
})
