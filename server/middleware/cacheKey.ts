import { canonicalCacheURL } from '#server/utils/cacheKey'
import { defineEventHandler } from 'nitro/h3'

/**
 * Normalises the query string of the routes cached by `routeRules`, so that
 * unrecognised or unbounded parameters can't multiply cache entries. See
 * `server/utils/cacheKey.ts` for why this is necessary and what it measured.
 *
 * This has to be middleware rather than a `getKey` on each handler: two of the
 * cached routes are pages (`/` and `/mobileClinic`), which have no handler of
 * ours to attach options to. Middleware runs before the route handler, and
 * Nitro's cache wrapper reads `event.url` when it builds the key, so
 * rewriting it here reaches the page and API routes alike.
 *
 * Rewriting the request URL also means the handler reads the same normalised
 * query the key was built from — the cache entry can never disagree with the
 * response that filled it. None of the affected routes read a query parameter
 * this drops (verified: neither page touches `useRoute().query`, and the
 * schedule endpoint takes no parameters).
 */
export default defineEventHandler((event) => {
  const url = event.path
  if (!url) return

  const canonical = canonicalCacheURL(url)
  if (canonical === undefined) return

  // H3 v2 exposes the parsed URL on the event. Updating it keeps both the
  // cache key and the handler query in sync without touching the Node request.
  event.url = new URL(canonical, event.req.url)
})
