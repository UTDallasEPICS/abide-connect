/**
 * Clears the session server-side.
 *
 * `auth` has no import statement because Nitro auto-imports everything exported
 * from `server/utils/`; it resolves to the instance in `server/utils/auth.ts`.
 *
 * Most of the app signs out through `authClient.signOut()` instead, which hits
 * better-auth's own `/api/auth/sign-out` — this file shadows that route for
 * POSTs, so both paths end up here.
 *
 * Not to be confused with the stray `server/sign-out.post.ts`, which sits
 * outside `server/api/` and is never registered as a route.
 */
export default defineEventHandler(async (event) => {
  try {
    const response = await auth.api.signOut({
      headers: event.headers,
    })

    return response
  }
  catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to sign out',
    })
  }
})
