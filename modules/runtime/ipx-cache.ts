import { dirname, join, resolve } from 'node:path'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createIPX, createIPXFetchHandler, ipxFSStorage, parseIPXURL } from 'ipx'
import { defineEventHandler, setResponseHeaders, setResponseStatus, toWebRequest } from 'h3'
import {
  ByteCappedLRU,
  IPX_BASE_URL,
  canonicalizeIPXPath,
  type CachedImage,
} from './ipx-cache-helpers'

/**
 * Location of the durable variant store. Must match the `ipxCache` nitro
 * storage mount in nuxt.config.ts (`base: './.cache/ipx'`), which the fs
 * driver resolves against the process cwd.
 */
const CACHE_DIR = resolve(process.cwd(), './.cache/ipx')
/**
 * Memory budget for the in-process LRU: ~2,000 variants at the observed
 * ~38-96 KB per webp, ~10% of the 600 MiB task reservation.
 */
const LRU_MAX_BYTES = 64 * 1024 * 1024

const MAX_AGE = 60 * 60 * 24 * 7

const ipx = createIPX({
  storage: ipxFSStorage({ dir: resolve(process.cwd(), 'public') }),
  maxAge: MAX_AGE,
})

const serveImage = createIPXFetchHandler(ipx, {
  parseURL(url: string) {
    const parsedURL = new URL(url)
    let pathname = parsedURL.pathname
    if (pathname === IPX_BASE_URL || pathname.startsWith(`${IPX_BASE_URL}/`)) {
      pathname = pathname.slice(IPX_BASE_URL.length) || '/'
    }
    return parseIPXURL(parsedURL.origin + pathname + parsedURL.search)
  },
})

const cache = new ByteCappedLRU(LRU_MAX_BYTES)
const inflight = new Map<string, Promise<{ entry: CachedImage, status: number }>>()

function cacheFilePath(cacheKey: string): string {
  return join(CACHE_DIR, cacheKey.replace(/:/g, '/'))
}

interface CachedImageJSON {
  headers?: Record<string, string>
  body?: string
}

function isValidEntry(entry: CachedImageJSON): entry is CachedImageJSON & { headers: Record<string, string>, body: string } {
  return typeof entry?.headers === 'object' && typeof entry?.body === 'string'
}

async function readCacheEntry(cacheKey: string): Promise<CachedImage | undefined> {
  try {
    const raw = await readFile(cacheFilePath(cacheKey), 'utf8')
    const entry: CachedImageJSON = JSON.parse(raw)
    if (isValidEntry(entry)) {
      return { headers: entry.headers, body: Buffer.from(entry.body, 'base64') }
    }
  }
  catch {
    // Missing or unreadable (e.g. a partially written file from an old run):
    // treat as a miss and let the caller regenerate it atomically.
  }
  return undefined
}

async function writeCacheEntry(cacheKey: string, entry: CachedImage): Promise<void> {
  const filePath = cacheFilePath(cacheKey)
  const tmpPath = `${filePath}.${process.pid}.${Date.now().toString(36)}.tmp`
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(tmpPath, JSON.stringify({ headers: entry.headers, body: entry.body.toString('base64') }), 'utf8')
  await rename(tmpPath, filePath)
}

function etagMatches(ifNoneMatch: string | null, etag: string | undefined) {
  if (!ifNoneMatch || !etag) return false
  if (ifNoneMatch === '*') return true
  return ifNoneMatch.split(',').some(tag => tag.trim() === etag)
}

function serve(entry: CachedImage, event: Parameters<Parameters<typeof defineEventHandler>[0]>[0], status = 200) {
  const { 'content-length': _staleLength, ...headers } = entry.headers
  headers['content-length'] = String(entry.body.byteLength)
  if (etagMatches(event.headers.get('if-none-match'), entry.headers.etag)) {
    setResponseHeaders(event, headers)
    setResponseStatus(event, 304)
    return null
  }
  setResponseStatus(event, status)
  setResponseHeaders(event, headers)
  return entry.body
}

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)
  const rawPath = event.path.split('?')[0]
  const cacheKey = canonicalizeIPXPath(rawPath)

  const hit = cache.get(cacheKey)
  if (hit) {
    return serve(hit, event)
  }

  const fromDisk = await readCacheEntry(cacheKey)
  if (fromDisk) {
    cache.set(cacheKey, fromDisk.headers, fromDisk.body)
    return serve(fromDisk, event)
  }

  let pending = inflight.get(cacheKey)
  if (!pending) {
    pending = render(cacheKey, rawPath, request).finally(() => {
      inflight.delete(cacheKey)
    })
    inflight.set(cacheKey, pending)
  }

  const rendered = await pending
  return serve(rendered.entry, event, rendered.status)
})

async function render(cacheKey: string, rawPath: string, request: Request): Promise<{ entry: CachedImage, status: number }> {
  // Always rebuild the request from the decoded path (h3 decodes %-escapes
  // before this handler sees `event.path`). Sending the raw request straight
  // to ipx is unsafe: an encoded `&` inside a modifier would otherwise reach
  // `parseIPXURL` as a literal `%26`, be treated as one unknown modifier, and
  // bypass webp/resize entirely.
  let canonicalRequest = request
  try {
    canonicalRequest = new Request(new URL(rawPath, request.url), request)
  }
  catch {
    // Fall back to the original request if we cannot rebuild it.
  }

  const response = await serveImage(canonicalRequest)
  const body = Buffer.from(await response.arrayBuffer())
  const headers = Object.fromEntries(response.headers.entries())

  if (response.status !== 200 || body.length === 0) {
    // Error/empty response (e.g. missing source): serve it without caching so
    // a transient upstream failure is retried instead of pinned.
    return { entry: { headers, body }, status: response.status }
  }

  try {
    await writeCacheEntry(cacheKey, { headers, body })
  }
  catch (error) {
    console.error('[ipx-cache] failed to persist', cacheKey, error)
  }
  cache.set(cacheKey, headers, body)
  return { entry: { headers, body }, status: 200 }
}
