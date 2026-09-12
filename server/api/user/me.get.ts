/**
 * The signed-in user's own `User` row, or `undefined` when there's no session.
 *
 * Returns rather than throwing a 401 so callers can treat "logged out" as a
 * normal state — the settings page uses it to decide what to render.
 *
 * `auth` and `prisma` have no import statements because Nitro auto-imports
 * everything exported from `server/utils/`.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  event.context.session = session

  if (!session?.session) {
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: session?.user.id },
  })

  return user
})
