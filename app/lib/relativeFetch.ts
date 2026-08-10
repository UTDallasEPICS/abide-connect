/* eslint-disable @typescript-eslint/no-explicit-any */
import { useFetch } from '#app'

/**
 * `useFetch` that tolerates absolute URLs by reducing them to a path.
 *
 * Nuxt dedupes SSR and client fetches by URL and replays the SSR payload on
 * hydration. An absolute URL breaks that: the server renders against one host
 * (often `localhost:3000` inside the container) while the browser sees the
 * public origin, so the two keys differ, the payload misses, and the request
 * runs twice — sometimes against a host the browser can't even reach.
 *
 * Stripping to a path makes both sides agree and keeps the request same-origin.
 * Prefer this over raw `useFetch`/`$fetch` anywhere the URL might arrive
 * absolute (config values, API-supplied links).
 *
 * Invalid URLs are passed through untouched; `new URL` only throws for strings
 * that were never usable anyway, and the caller's own error handling is better
 * placed to report it.
 *
 * Typed `as any` because it forwards to `useFetch` without reproducing its
 * generic signature — callers get no type inference on the response.
 */
export const relativeFetch = ((url: string, opts?: any) => {
  try {
    if (url.startsWith('http')) url = new URL(url).pathname
  }
  catch {
    // ignore invalid URLs
  }
  return useFetch(url, opts)
}) as any
