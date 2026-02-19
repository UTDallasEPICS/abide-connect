import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  return await prisma.volunteer.findMany({
    select: {
      id: true,
      name: true,
      zoomVerified: true
    }
  });
});
