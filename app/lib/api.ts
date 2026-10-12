/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_BASE_URL } from './config'

/**
 * Minimal `$fetch`/`ofetch` replacement for the native app.
 *
 * Nuxt's `$fetch` is `ofetch`, whose npm entry resolves to a Node build
 * (`node:http`) that NativeScript's webpack cannot bundle — so the native
 * side talks to the platform `fetch` (a WHATWG polyfill over XHR, see
 * `@nativescript/core/fetch`) directly.
 *
 * Errors are normalised to {@link ApiError} with a `statusMessage`, the same
 * property shape `$fetch` errors expose, so `app/lib/errorMessage.ts` keeps
 * working unchanged.
 *
 * Cookies: better-auth authenticates with an HttpOnly session cookie. The
 * request always sets `credentials: 'include'`, and a small JS cookie jar
 * below re-sends `set-cookie` values as a `Cookie` header. The jar is a
 * belt-and-braces fallback — whether the underlying platform cookie store
 * already persists them across requests is device-verified in Phase 3 (see
 * docs/native-migration/README.md).
 */

export class ApiError extends Error {
  readonly statusCode: number
  readonly statusMessage: string
  readonly data: unknown

  constructor(statusCode: number, statusMessage: string, data: unknown) {
    super(statusMessage)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.statusMessage = statusMessage
    this.data = data
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean | undefined | null>
}

// Module-level so it is shared by every caller (one app, one session).
const cookieJar = new Map<string, string>()

/** Drop the current session cookies (used on sign-out). */
export function clearSessionCookies(): void {
  cookieJar.clear()
}

function cookieHeader(): string | undefined {
  if (cookieJar.size === 0) return undefined
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
}

/**
 * Store cookies from a `set-cookie` header value.
 *
 * A single header may carry several cookies joined by commas, but an
 * `Expires` date also contains a comma — so split only on commas that are
 * followed by what looks like the start of a new `name=value` pair, and take
 * only the part before the first `;` as the pair itself.
 */
function storeSetCookies(raw: string | null): void {
  if (!raw) return
  for (const part of raw.split(/,(?=\s*[^=;,\s]+\s*=)/)) {
    const pair = part.split(';', 1)[0]?.trim()
    if (!pair) continue
    const eq = pair.indexOf('=')
    if (eq <= 0) continue
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (name && value) cookieJar.set(name, value)
    else if (name) cookieJar.delete(name)
  }
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const base = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
  if (!query) return base
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  if (!search) return base
  return `${base}${base.includes('?') ? '&' : '?'}${search}`
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const cookie = cookieHeader()
  if (cookie) headers['Cookie'] = cookie

  let response: any
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    })
  }
  catch (error) {
    // Network-level failure (offline, DNS, TLS). Surface it the same way a
    // non-2xx does so callers have one error type to handle.
    throw new ApiError(0, (error as Error)?.message ?? 'Network request failed', null)
  }

  storeSetCookies(response.headers?.get?.('set-cookie') ?? null)

  const text = await response.text()
  let data: any
  if (text) {
    try {
      data = JSON.parse(text)
    }
    catch {
      data = text
    }
  }

  if (!response.ok) {
    const statusMessage = data?.statusMessage ?? data?.message ?? `Request failed (${response.status})`
    throw new ApiError(response.status, statusMessage, data)
  }

  return data as T
}
