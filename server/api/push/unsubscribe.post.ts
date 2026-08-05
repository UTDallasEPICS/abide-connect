import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

/**
 * Drops a push subscription. Scoped to the caller's own rows so one user can't
 * unsubscribe another's device by guessing an endpoint.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  }

  const { endpoint } = await readBody(event)
  if (typeof endpoint !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing endpoint' })
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  })

  return { success: true }
})
