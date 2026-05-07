import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  const result = await prisma.volunteerApplication.create({
    data: {
      firstName: "TEST",
      lastName: "TEST",
      email: Math.random() + "@test.com",
      over18: true,
      backgroundCheck: true,
      agreement: true,
    },
  });

  console.log("🔥 INSERTED:", result);

  return result;
});