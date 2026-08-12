/**
 * DEAD FILE — not a route and never executed.
 *
 * Nitro only registers handlers under `server/api/` and `server/routes/`. This
 * sits at the root of `server/`, so it is never mounted and no URL reaches it.
 * The working copy is `server/api/auth/sign-out.post.ts`, which this duplicates.
 *
 * Safe to delete; kept out of this pass because removing files is a separate
 * change from documenting them.
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
