interface RouteRoleConfig {
  role: string
  unauthorizedPage?: string
}

/**
 * Route prefixes mapped to the role required to access them.
 * Optional `unauthorizedPage` overrides the default redirect for that route.
 *
 * WARNING: Don't put a custom unauthorizedPage inside the protected route's
 * own folder, or you'll create an infinite redirect loop.
 */
const routeRoles: Record<string, RouteRoleConfig> = {
  '/admin':                     { role: 'admin' },
  '/events/manage':             { role: 'admin' },
  '/volunteer':                 { role: 'volunteer', unauthorizedPage: '/volunteer-application/form-required' },
  '/volunteer-application':     { role: 'user' },
}

const SHOW_DEBUG = true
const DEFAULT_UNAUTHORIZED_PAGE = '/unauthorized'
const DEFAULT_LOGIN_PAGE = '/auth/login'

/**
 * Matches a path against a route prefix on a segment boundary,
 * so `/volunteer` won't match `/volunteer-sign-up-page`.
 */
function matchesRoute(path: string, route: string): boolean {
  return path === route || path.startsWith(`${route}/`)
}

export default defineNuxtRouteMiddleware(async (to) => {
  const path = to.path

  const matched = Object.entries(routeRoles)
    .sort(([a], [b]) => b.length - a.length) // longest prefix first, in case of overlapping routes
    .find(([route]) => matchesRoute(path, route))

  if (!matched) return

  const [, config] = matched
  const unauthorizedPage = config.unauthorizedPage ?? DEFAULT_UNAUTHORIZED_PAGE

  const headers = useRequestHeaders(['cookie'])
  const { data: session } = await useFetch('/api/auth/get-session', { headers })

  if (!session.value?.session) {
    return navigateTo(DEFAULT_LOGIN_PAGE)
  }

  const roles = await $fetch<string[]>('/api/user/roles', { headers })

  if (SHOW_DEBUG) {
    console.log(`[auth] path: ${path} | required: ${config.role} | user roles: [${roles.join(', ')}]`)
  }

  if (!roles.includes(config.role)) {
    return navigateTo(unauthorizedPage)
  }
})