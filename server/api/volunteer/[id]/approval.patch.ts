import prisma from '#server/utils/prisma'
import { requireRole } from '#server/utils/requireRole'
import type { ApprovalStatus } from '#server/utils/generated/prisma/client'

/**
 * Approves or denies a volunteer, promoting a pending volunteer to a full
 * volunteer (APPROVED) or rejecting them (REJECTED). Admin only.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing volunteer ID' })
  }

  const { status } = await readBody(event)
  if (status !== 'APPROVED' && status !== 'REJECTED') {
    throw createError({ statusCode: 400, message: 'status must be APPROVED or REJECTED' })
  }

  const volunteer = await prisma.volunteer.update({
    where: { id },
    data: { approvalStatus: status as ApprovalStatus },
    select: { id: true, approvalStatus: true },
  })

  return volunteer
})
