import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  return await prisma.volunteerApplication.findMany({
    orderBy: { createdAt: "desc" },
  });
});