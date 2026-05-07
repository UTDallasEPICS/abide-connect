import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  console.log("DELETE HIT", query)

  return await prisma.trainingCertificate.delete({
    where: { id: Number(query.id) }
  })
})