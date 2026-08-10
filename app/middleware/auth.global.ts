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
  // The profile page is open to any signed-in user. Users who haven't applied
  // to volunteer see it with a prompt to apply, instead of being bounced to
  // an error.
  '/volunteer':                 { role: 'user' },
  '/volunteer-application':     { role: 'user' },
}

// Logs the role check on every guarded navigation. Currently on in production
// too, where it puts user ids and role lists into the browser console — worth
// flipping to false, or keying off `import.meta.dev`.
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

/**
 * Global role guard. Runs on every navigation, but only acts on paths matching
 * a prefix in `routeRoles` above — everything else passes through untouched.
 *
 * This is the app's only broad access check: the server-side equivalent
 * (`server/middleware/authenticated.ts`) was deliberately emptied, so server
 * routes each enforce their own access via `requireRole`. That makes this
 * middleware a UX affordance rather than a security boundary — it decides what
 * renders, not what the API will hand out. Never rely on it to protect data.
 *
 * Roles are fetched from `/api/user/roles` rather than read off the session
 * because the session payload doesn't carry them and Prisma can't run in the
 * browser. Cookies are forwarded explicitly so the calls work during SSR,
 * where there's no ambient credential context.
 *
 * Two sequential round-trips per guarded navigation (session, then roles);
 * they can't be parallelised as written since the roles call is skipped when
 * there's no session.
 */
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