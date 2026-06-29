import { H3Event, createError } from 'h3'

/**
 * Guards a server route by role. Throws 401 if the user isn't logged in,
 * 403 if they don't have at least one of the required roles.
 *
 * Requires auth middleware to have already set `event.context.user`.
 *
 * @example
 * requireRole(event, 'ADMIN')
 * requireRole(event, 'ADMIN', 'VOLUNTEER') // either role works
 */
export function requireRole(event: H3Event, ...roles: string[]) {
  const user = event.context.user

  if (!user) {
    throw createError({ statusCode: 401, message: 'Not authenticated' })
  }

  const hasRole = roles.some(role => user.roles.includes(role))

  if (!hasRole) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
}