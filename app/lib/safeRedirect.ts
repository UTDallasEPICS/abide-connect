/**
 * Resolves a `?redirect=` query value into a path we're willing to send a
 * freshly authenticated user to.
 *
 * Only same-site absolute paths pass. A value carrying its own scheme
 * (`https://evil.example`), a protocol-relative `//host`, or a backslash the
 * browser may normalise into one, would bounce the user off-site right after
 * they signed in, so anything but a plain `/path` collapses to the fallback.
 *
 * @example
 * const to = safeRedirect(route.query.redirect)          // '/events/abc'
 * const to = safeRedirect('https://evil.example')        // '/'
 */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}
