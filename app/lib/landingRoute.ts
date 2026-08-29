import { safeRedirect } from './safeRedirect'

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
 * Otherwise it's decided by role: admins get the dashboard, everyone else their
 * profile — the same pair `NavBottom` points its profile tab at.
 *
 * Roles come from a plain `$fetch` rather than `useUserRoles()` on purpose. That
 * composable shares one keyed `useFetch` across the app, and the copy cached
 * while the user was signed out is exactly the answer we must not get here.
 *
 * Falls back to `/` when there are no roles at all: `/volunteer` requires `user`
 * (see `auth.global.ts`), so sending a roleless account there would bounce it
 * straight to `/unauthorized`.
 */
export async function resolveLandingRoute(redirect?: unknown): Promise<string> {
  const explicit = safeRedirect(redirect, '')
  if (explicit) return explicit

  const roles = await $fetch<string[]>('/api/user/roles').catch(() => [] as string[])

  if (roles.includes('admin')) return '/admin'
  if (roles.includes('user') || roles.includes('volunteer')) return '/volunteer'
  return '/'
}
