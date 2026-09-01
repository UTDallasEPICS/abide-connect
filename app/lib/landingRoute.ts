import { safeRedirect } from './safeRedirect'

/**
 * The landing page for a set of roles: admins get the dashboard, everyone else
 * their profile — the same pair `NavBottom` points its profile tab at.
 *
 * Falls back to `/` when there are no roles at all. `/volunteer` requires `user`
 * (see `auth.global.ts`), so sending a roleless account there would bounce it
 * straight on to `/unauthorized`.
 */
export function landingRouteForRoles(roles: string[]): string {
  if (roles.includes('admin')) return '/admin'
  if (roles.includes('user') || roles.includes('volunteer')) return '/volunteer'
  return '/'
}

/**
 * Where a freshly authenticated user lands.
 *
 * Every sign-in path ends here — the OTP form, the sign-up flow, and the Google
 * callback — so the three don't drift into three different ideas of "home".
 *
 * An explicit `?redirect=` wins. That's the "sign in to register" hop off an
 * event page, and dropping someone on their dashboard instead of the thing they
 * were trying to do is the whole reason that param exists. It goes through
 * `safeRedirect`, so an off-site value is discarded rather than followed.
 *
 * Pass `roles` whenever the caller already has them. The OTP endpoints return
 * them alongside the session they just minted precisely so that this doesn't
 * have to ask: a `/api/user/roles` call fired in the same breath as the response
 * setting the session cookie is racing that cookie, and an empty answer is
 * indistinguishable from a user who genuinely has no roles — which lands
 * everyone on `/` with nothing to show for it. Only the Google callback omits
 * them, and that one arrives on a fresh page load with the cookie long settled.
 */
export async function resolveLandingRoute(
  redirect?: unknown,
  roles?: string[],
): Promise<string> {
  const explicit = safeRedirect(redirect, '')
  if (explicit) return explicit

  if (roles) return landingRouteForRoles(roles)

  try {
    // `no-store` for the same reason `auth.ts` uses it on the session: the
    // response carries no cache directives of its own, and a signed-out `[]`
    // served back from cache here is invisible and lands the user on `/`.
    const fetched = await $fetch<string[]>('/api/user/roles', { cache: 'no-store' })
    return landingRouteForRoles(fetched)
  }
  catch (error) {
    // Deliberately loud. Falling through to `/` silently is exactly the failure
    // that's impossible to tell apart from working correctly.
    console.error('[auth] Could not read roles to pick a landing page:', error)
    return '/'
  }
}
