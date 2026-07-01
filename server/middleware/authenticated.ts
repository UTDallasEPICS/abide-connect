import { auth } from '#server/utils/auth'
import prisma from '#server/utils/prisma'

interface RouteRoleConfig {
  role: string
  unauthorizedPage?: string
}

/**
 * Route prefixes mapped to the role required to access them.
 * Matches both page and API routes (`/admin` and `/api/admin`).
 * Optional `unauthorizedPage` overrides the default redirect for that route.
 * 
 * WARNING: Be careful not to put the a custom unatuhorized page within the folder of the protected route, 
 * or you will create an infinite redirect loop.
 */
const routeRoles: Record<string, RouteRoleConfig> = {
  '/admin':     { role: 'admin' },
  '/volunteer': { role: 'volunteer', unauthorizedPage: '/training' },
}

const SHOW_DEBUG = false;
const DEFAULT_UNAUTHORIZED_PAGE = '/unauthorized'
const DEFAULT_LOGIN_PAGE = '/auth/login'

/**
 * Denies the current request — throws a 401/403 for API routes,
 * or redirects to login (not logged in) / unauthorizedPage (wrong role).
 *
 * @example
 * return deny(event, false, true, '/volunteer/unauthorized')
 */
function deny(event: any, isApi: boolean, loggedIn: boolean, unauthorizedPage: string) {
  if (isApi) {
    throw createError({
      statusCode: loggedIn ? 403 : 401,
      message: loggedIn ? 'Forbidden' : 'Unauthorized',
    })
  }
  return sendRedirect(event, loggedIn ? unauthorizedPage : DEFAULT_LOGIN_PAGE, 302)
}

/**
 * Global middleware enforcing role-based access control.
 * Attaches the session to `event.context.session`, then checks protected
 * routes from `routeRoles` and denies access if unauthenticated or missing role.
 */
export default defineEventHandler(async (event) => {
  const path = event.path
  const isApi = path.startsWith('/api')
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  for (const [route, config] of Object.entries(routeRoles)) {
    if (path.startsWith(route) || path.startsWith(`/api${route}`)) {
      const unauthorizedPage = config.unauthorizedPage ?? DEFAULT_UNAUTHORIZED_PAGE

      if (!session?.session) {
        return deny(event, isApi, false, unauthorizedPage)
      }

      const userRoles = await prisma.user_Role.findMany({
        where: { userId: session.user.id, active: true },
      })

      const roles = userRoles.map(r => r.role.toLowerCase())

      if (SHOW_DEBUG)
      {
        console.log(`[auth] path: ${path} | required: ${config.role} | user roles: [${roles.join(', ')}]`)
      }

      if (!roles.includes(config.role)) {
        return deny(event, isApi, true, unauthorizedPage)
      }
    }
  }
})