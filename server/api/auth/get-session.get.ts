import { auth } from '#server/utils/auth'

/**
 * Returns the current session, or `{ session: null, user: null }` when there
 * isn't one — never a 401. The `after` hook in `server/utils/auth.ts` is what
 * normalises the anonymous case, which is why callers can read `.session`
 * without checking the status first.
 *
 * This is the session source for both route guards
 * (`app/middleware/auth.global.ts`, `app/middleware/auth.ts`) and so runs on
 * essentially every navigation.
 *
 * Note it shadows the `/get-session` route better-auth already serves via
 * `[...all].ts`; this explicit file wins for GET requests.
 */
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  return session
})
