import { requireRole } from '~~/server/utils/requireRole'

/**
 * Permanently removes an hour log. Admin only.
 *
 * A hard delete, so approved hours vanish from the volunteer's total with no
 * audit trail — denying a log (`[id].patch.ts` with `approvalStatus`) is
 * usually the right action, and this is for genuine mistakes.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'Admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Hour log id is required' })
  }

  await prisma.volunteer_Hour_Log.delete({ where: { id: Number(id) } })

  return { success: true }
})
