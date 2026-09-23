import { describe, expect, it } from 'vitest'
import { canonicalCacheURL } from '../../server/utils/cacheKey'

/**
 * These guard a denial-of-service property, not a formatting preference:
 * Nitro keys its response cache on a hash of the full request URL, so any
 * cached route that accepts an unbounded query parameter lets an attacker
 * mint unbounded cache entries. See server/utils/cacheKey.ts.
 */
describe('canonicalCacheURL', () => {
  it('leaves routes that are not cached alone', () => {
    expect(canonicalCacheURL('/api/events/list?search=x&page=2')).toBeUndefined()
    expect(canonicalCacheURL('/api/auth/callback/google?code=a&state=b')).toBeUndefined()
    expect(canonicalCacheURL('/events/abc?tab=1')).toBeUndefined()
  })

  it('returns undefined when there is no query to normalise', () => {
    expect(canonicalCacheURL('/')).toBeUndefined()
    expect(canonicalCacheURL('/api/events/upcoming')).toBeUndefined()
  })

  it('strips every parameter from routes that take none', () => {
    expect(canonicalCacheURL('/?utm_source=twitter')).toBe('/')
    expect(canonicalCacheURL('/mobileClinic?junk=1')).toBe('/mobileClinic')
    expect(canonicalCacheURL('/api/mobile-clinic/schedule?x=1')).toBe('/api/mobile-clinic/schedule')
  })

  it('keeps a valid limit and drops everything else', () => {
    expect(canonicalCacheURL('/api/events/upcoming?limit=9')).toBeUndefined()
    expect(canonicalCacheURL('/api/events/upcoming?limit=9&junk=1')).toBe('/api/events/upcoming?limit=9')
    expect(canonicalCacheURL('/api/events/today?nope=1')).toBe('/api/events/today')
  })

  it('collapses unbounded limits to a single key', () => {
    // The whole point: 50 and up must all land on one entry.
    const keys = new Set(
      [50, 51, 999, 1e6, 1e9].map(n => canonicalCacheURL(`/api/events/week?limit=${n}`) ?? `/api/events/week?limit=${n}`),
    )
    expect(keys).toEqual(new Set(['/api/events/week?limit=50']))
  })

  it('drops junk limits so the handler applies its own default', () => {
    for (const bad of ['abc', '', '-1', '0', 'NaN', 'Infinity', '1e999']) {
      expect(canonicalCacheURL(`/api/events/training?limit=${bad}`)).toBe('/api/events/training')
    }
  })

  it('truncates fractional limits rather than creating a key per decimal', () => {
    expect(canonicalCacheURL('/api/events/upcoming?limit=9.7')).toBe('/api/events/upcoming?limit=9')
    expect(canonicalCacheURL('/api/events/upcoming?limit=9.8')).toBe('/api/events/upcoming?limit=9')
  })

  it('keeps a plausible date but rejects a malformed one', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(canonicalCacheURL(`/api/events/by-day?date=${today}`)).toBeUndefined()
    expect(canonicalCacheURL('/api/events/by-day?date=not-a-date')).toBe('/api/events/by-day')
    expect(canonicalCacheURL('/api/events/by-day?date=2026-13-45')).toBe('/api/events/by-day')
  })

  it('bounds the date window so year 0001-9999 is not 3.6M keys', () => {
    expect(canonicalCacheURL('/api/events/by-day?date=0001-01-01')).toBe('/api/events/by-day')
    expect(canonicalCacheURL('/api/events/by-day?date=9999-12-31')).toBe('/api/events/by-day')
  })

  it('sorts parameters so key order cannot fork the cache', () => {
    // Not reachable today (no cached route takes two parameters), but the
    // moment one does, ?a=1&b=2 and ?b=2&a=1 must not be two entries.
    const a = canonicalCacheURL('/api/events/upcoming?limit=5&zzz=1')
    const b = canonicalCacheURL('/api/events/upcoming?zzz=1&limit=5')
    expect(a).toBe(b)
  })
})
