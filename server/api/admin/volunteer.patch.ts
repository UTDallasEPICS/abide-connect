import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  return await prisma.trainingCertificate.update({
    where: {
      id: body.id
    },
    data: {
      status: body.verified ? "APPROVED" : "PENDING"
    }
  });
});