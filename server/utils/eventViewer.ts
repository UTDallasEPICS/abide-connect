import type { H3Event } from 'h3'
import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'
import { ANONYMOUS_VIEWER, type EventViewer, type VolunteerStatus } from '#shared/utils/eventType'

export interface RequestViewer extends EventViewer {
  userId: string | null
}

/**
 * Resolves who is making the request, in the terms event visibility cares
 * about: are they staff, and what's their volunteer approval status. Used to
 * hide volunteer-only and training events from everyone else.
 *
 * @example
 * const viewer = await getEventViewer(event)
 * if (!canViewEvent(foundEvent, viewer)) {
 *   throw createError({ statusCode: 404, message: 'Event not found' })
 * }
 */
export async function getEventViewer(event: H3Event): Promise<RequestViewer> {
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.session) {
    return { ...ANONYMOUS_VIEWER, userId: null }
  }

  const [userRoles, volunteer] = await Promise.all([
    prisma.user_Role.findMany({
      where: { userId: session.user.id, active: true },
    }),
    prisma.volunteer.findUnique({
      where: { userId: session.user.id },
      select: { approvalStatus: true },
    }),
  ])

  return {
    userId: session.user.id,
    isAdmin: userRoles.some(r => r.role.toLowerCase() === 'admin'),
    volunteerStatus: (volunteer?.approvalStatus as VolunteerStatus) ?? 'NONE',
  }
}
