import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  return await prisma.trainingCertificate.findMany({
    where: { status: "PENDING" }
  });
});

