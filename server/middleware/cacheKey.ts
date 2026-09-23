import { canonicalCacheURL } from '#server/utils/cacheKey'

/**
 * Normalises the query string of the routes cached by `routeRules`, so that
 * unrecognised or unbounded parameters can't multiply cache entries. See
 * `server/utils/cacheKey.ts` for why this is necessary and what it measured.
 *
 * This has to be middleware rather than a `getKey` on each handler: two of the
 * cached routes are pages (`/` and `/mobileClinic`), which have no handler of
 * ours to attach options to. Middleware runs before the route handler, and
 * Nitro's cache wrapper reads `event.node.req.url` when it builds the key, so
 * rewriting it here reaches the page and API routes alike.
 *
 * Rewriting the request URL also means the handler reads the same normalised
 * query the key was built from — the cache entry can never disagree with the
 * response that filled it. None of the affected routes read a query parameter
 * this drops (verified: neither page touches `useRoute().query`, and the
 * schedule endpoint takes no parameters).
 */
export default defineEventHandler((event) => {
  const url = event.node.req.originalUrl || event.node.req.url
  if (!url) return

  const canonical = canonicalCacheURL(url)
  if (canonical === undefined) return

  // All three, and `originalUrl` above all. h3 stamps
  // `req.originalUrl = req.originalUrl || req.url` when it builds the H3Event,
  // which happens before any middleware runs, and Nitro's cache key reads
  // `originalUrl` FIRST — so rewriting only `req.url` changes what the handler
  // sees while leaving the cache key on the original junk query. That is the
  // bug this middleware exists to prevent, so it is worth the belt and braces.
  event.node.req.originalUrl = canonical
  event.node.req.url = canonical
  event._path = canonical
})
