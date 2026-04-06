import prisma from '~~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  return prisma.donation.create({
    data: {
      name: body.name,
      link: body.link,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      imageUrl: '',
    },
  })
})