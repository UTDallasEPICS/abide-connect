/**
 * Intentionally a no-op.
 *
 * This used to be the global server-side access gate: it attached the session
 * to `event.context.session` and enforced a `routeRoles` map covering both
 * `/admin` and `/api/admin`. That was removed in "user roles client middleware
 * migration & api role protection", which split the job in two:
 *
 *   - Page access is guarded on the client by `app/middleware/auth.global.ts`.
 *   - API access is enforced per-handler by `requireRole()`
 *     (`#server/utils/requireRole`), which also populates
 *     `event.context.session`.
 *
 * The consequence worth knowing: nothing authenticates a server route unless
 * that route asks for it. A new handler under `server/api/` is public until it
 * calls `requireRole` (or `getEventViewer` for visibility-filtered reads), so
 * that call is a required step when adding endpoints, not a nicety.
 *
 * The file is kept as a placeholder because Nitro auto-registers everything in
 * `server/middleware/`; restoring a global check means filling this in, but
 * beware it would then run on every request including static/public routes.
 */
export default defineEventHandler(async () => {

})
