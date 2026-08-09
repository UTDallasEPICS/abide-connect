/**
 * Opt-in guard requiring *any* signed-in user, with no role requirement.
 *
 * Not global — a page has to ask for it explicitly:
 *
 *     definePageMeta({ middleware: 'auth' })
 *
 * (see `settings.vue`, `inbox.vue`). Everything else is reachable logged-out
 * unless it matches a prefix in `auth.global.ts`, which is the sibling that
 * *is* global and checks roles rather than mere presence of a session.
 *
 * The `publicRoutes` allowlist looks redundant given the middleware is opt-in,
 * but it guards against an auth page ever pulling this in and bouncing the
 * user to login from the login page.
 *
 * Caching is disabled on the session request because a stale hit here means
 * showing a signed-out user someone else's page, or bouncing a signed-in user
 * to login right after they authenticate.
 *
 * This is UX, not security: it only decides what renders. Server routes must
 * still enforce their own access — see `requireRole`.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/auth/login', '/auth/sign-up', '/auth/sign-up-verify']
  if (publicRoutes.includes(to.path)) return

  try {
    const data = await $fetch('/api/auth/get-session', {
      cache: 'no-store', // ← forces fresh request every time
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    if (!data?.session) {
      return navigateTo('/auth/login')
    }
  }
  catch {
    return navigateTo('/auth/login')
  }
})
