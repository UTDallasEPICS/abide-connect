/**
 * Liveness probe. Returns 200 with a fixed body and touches nothing —
 * no database, no session, no external call — so an ALB/ECS health check
 * measures whether the Node process is accepting requests rather than
 * whether SQLite happens to be responsive.
 *
 * Deliberately uncached (`routeRules` doesn't list it): a cached 200 would
 * keep reporting healthy after the process stopped being able to serve.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'cache-control', 'no-store')
  return { status: 'ok' }
})
