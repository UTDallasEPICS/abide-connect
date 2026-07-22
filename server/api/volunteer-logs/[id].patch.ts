import prisma from '#server/utils/prisma'
import { requireRole } from '~~/server/utils/requireRole';

export default eventHandler(async (event) => {
  const session = await requireRole(event, 'admin');

  try {
    const id = getRouterParam(event, 'id')
    const body = await readBody(event)
    const { status, comment } = body

    if (!id || !status) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Log ID and status are required',
      })
    }

    const updated = await prisma.volunteer_Hour_Log.update({
      where: { id: Number(id) },
      data: {
        approvalStatus: status,
        comment: comment ?? null,
      },
    })

    return {
      success: true,
      log: updated,
    }
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update volunteer log',
      cause: error,
    })
  }
})
