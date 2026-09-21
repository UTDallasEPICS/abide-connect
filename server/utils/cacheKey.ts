/**
 * Canonical query strings for the routes cached by `routeRules` in
 * nuxt.config.ts.
 *
 * WHY THIS EXISTS: Nitro keys its response cache on a hash of the whole
 * request URL, query string included
 * (`hash(event.node.req.originalUrl || event.node.req.url || event.path)` in
 * nitropack's internal cache.mjs). Every distinct query string is therefore a
 * distinct cache entry, held in the in-memory cache for the TTL — and none of
 * the cached handlers reject junk parameters, they just fall back to a
 * default. So `?limit=1`, `?limit=2`, ... `?limit=100000` all return the same
 * bytes under a hundred thousand different keys.
 *
 * Measured before this existed: 5000 requests spread over 5000 distinct query
 * strings cost ~117 MB of RSS more than the same 5000 requests to one key.
 * On a single ECS task that is a cheap denial of service, and the page routes
 * are worse than the API ones because an entry is a whole HTML document.
 *
 * The fix is to normalise the URL *before* the cache layer computes its key.
 * `server/middleware/cacheKey.ts` does that; this module owns the rules. The
 * handler sees the normalised query too, which is the point — the cache key
 * and the response can't disagree.
 *
 * Keep this in sync with `routeRules`: a cached route that takes a query
 * parameter and is missing here is an unbounded cache key.
 */

/** Largest `?limit=` any public feed will honour. Bounds key cardinality to 50. */
const MAX_LIMIT = 50

/**
 * How far either side of today `?date=` may address. A calendar can be paged
 * a long way, but not infinitely — without a bound, years 0001-9999 are ~3.6M
 * distinct cache keys. Out-of-window dates fall back to today, which is what
 * `by-day.get.ts` already does with a malformed one.
 */
const DATE_WINDOW_DAYS = 365 * 5

function canonicalLimit(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const n = Number(raw)
  // Anything unparseable is dropped so the handler applies its own default,
  // which is what `Number(query.limit) || <default>` already did.
  if (!Number.isFinite(n) || n < 1) return undefined
  return String(Math.min(Math.floor(n), MAX_LIMIT))
}

function canonicalDate(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  const t = Date.parse(`${raw}T00:00:00Z`)
  if (Number.isNaN(t)) return undefined
  const days = Math.abs(t - Date.now()) / 86_400_000
  return days > DATE_WINDOW_DAYS ? undefined : raw
}

type Canonicaliser = (params: URLSearchParams) => URLSearchParams

const keepNothing: Canonicaliser = () => new URLSearchParams()

const keepLimit: Canonicaliser = (params) => {
  const out = new URLSearchParams()
  const limit = canonicalLimit(params.get('limit') ?? undefined)
  if (limit !== undefined) out.set('limit', limit)
  return out
}

const keepDate: Canonicaliser = (params) => {
  const out = new URLSearchParams()
  const date = canonicalDate(params.get('date') ?? undefined)
  if (date !== undefined) out.set('date', date)
  return out
}

/** Pathname -> how to canonicalise its query. Only exact paths are cached. */
export const CACHED_ROUTE_QUERIES: Record<string, Canonicaliser> = {
  '/': keepNothing,
  '/mobileClinic': keepNothing,
  '/api/mobile-clinic/schedule': keepNothing,
  '/api/events/upcoming': keepLimit,
  '/api/events/today': keepLimit,
  '/api/events/week': keepLimit,
  '/api/events/training': keepLimit,
  '/api/events/by-day': keepDate,
}

/**
 * Returns the canonical URL for a cached route, or undefined when the route
 * isn't cached or the URL is already canonical (so the common case allocates
 * nothing and mutates nothing).
 */
export function canonicalCacheURL(url: string): string | undefined {
  const qIndex = url.indexOf('?')
  if (qIndex === -1) return undefined

  const pathname = url.slice(0, qIndex)
  const canonicalise = CACHED_ROUTE_QUERIES[pathname]
  if (!canonicalise) return undefined

  const canonical = canonicalise(new URLSearchParams(url.slice(qIndex + 1)))
  canonical.sort()
  const query = canonical.toString()
  const next = query ? `${pathname}?${query}` : pathname
  return next === url ? undefined : next
}
