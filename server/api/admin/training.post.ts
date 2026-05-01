import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  return await prisma.trainingCertificate.create({
    data: {
      name: body.name,
      email: body.email,
      fileUrl: "",
      status: "PENDING"
    }
  });
});