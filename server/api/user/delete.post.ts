import { readBody, defineEventHandler, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ userId?: string }>(event)
  const userId = body.userId

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { volunteer: true },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // NOTE: assumes Volunteer has a `userId` FK and HourLog has a
  // `volunteerId` FK. Adjust field names here if your schema differs.
  await prisma.$transaction(async (tx) => {
    if (user.volunteer) {
      await tx.volunteer_Hour_Log.deleteMany({ where: { volunteerId: user.volunteer.id } })
      await tx.volunteer.delete({ where: { userId } })
    }

    await tx.user_Role.deleteMany({ where: { userId } })
    await tx.user_Notification.deleteMany({ where: { userId } })
    await tx.rSVP.deleteMany({ where: { userId } })
    await tx.session.deleteMany({ where: { userId } })
    await tx.account.deleteMany({ where: { userId } })

    await tx.user.delete({ where: { id: userId } })
  })

  return { userId, deleted: true }
})