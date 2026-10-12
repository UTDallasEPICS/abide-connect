import { apiFetch } from './api'
import { safeRedirect } from './safeRedirect'

/**
 * The landing page for a set of roles: admins get the dashboard, everyone else
 * their profile — the same pair the bottom nav points its profile tab at.
 *
 * Falls back to `/` when there are no roles at all. `/volunteer` requires `user`
 * (see the route-role table in `app/composables/useNativeNavigate.ts`), so
 * sending a roleless account there would bounce it straight on to
 * `/unauthorized`.
 */
export function landingRouteForRoles(roles: string[]): string {
  if (roles.includes('admin')) return '/admin'
  if (roles.includes('user') || roles.includes('volunteer')) return '/volunteer'
  return '/'
}

/**
 * Where a freshly authenticated user lands.
 *
 * Every sign-in path ends here, so the OTP form, the sign-up flow and the
 * Google callback don't drift into three different ideas of "home".
 *
 * An explicit `?redirect=` wins, sanitised through `safeRedirect` so an
 * off-site value is discarded rather than followed. Otherwise roles decide.
 * The OTP verification endpoint returns `roles` alongside the session it just
 * minted, so callers should pass them and avoid a `/api/user/roles` read that
 * races the cookie being set.
 */
export async function resolveLandingRoute(
  redirect?: unknown,
  roles?: string[],
): Promise<string> {
  const explicit = safeRedirect(redirect, '')
  if (explicit) return explicit

  if (roles) return landingRouteForRoles(roles)

  try {
    const fetched = await apiFetch<string[]>('/api/user/roles')
    return landingRouteForRoles(fetched)
  }
  catch (error) {
    // Deliberately loud. Falling through to `/` silently is exactly the failure
    // that's impossible to tell apart from working correctly.
    console.error('[auth] Could not read roles to pick a landing page:', error)
    return '/'
  }
}
