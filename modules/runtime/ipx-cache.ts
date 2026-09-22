import { resolve } from 'node:path'
import { createIPX, createIPXFetchHandler, ipxFSStorage, parseIPXURL } from 'ipx'
import { defineEventHandler, setResponseHeaders, setResponseStatus, toWebRequest } from 'h3'
import { useStorage } from '#imports'

interface CachedImage {
  headers: Record<string, string>
  body: string
}

const BASE_URL = '/_ipx'
const MAX_AGE = 60 * 60 * 24 * 7

const ipx = createIPX({
  storage: ipxFSStorage({ dir: resolve(process.cwd(), 'public') }),
  maxAge: MAX_AGE,
})

const serveImage = createIPXFetchHandler(ipx, {
  parseURL(url: string) {
    const parsedURL = new URL(url)
    let pathname = parsedURL.pathname
    if (pathname === BASE_URL || pathname.startsWith(`${BASE_URL}/`)) {
      pathname = pathname.slice(BASE_URL.length) || '/'
    }
    return parseIPXURL(parsedURL.origin + pathname + parsedURL.search)
  },
})

function etagMatches(ifNoneMatch: string | null, etag: string | undefined) {
  if (!ifNoneMatch || !etag) return false
  if (ifNoneMatch === '*') return true
  return ifNoneMatch.split(',').some(tag => tag.trim() === etag)
}

export default defineEventHandler(async (event) => {
  const cacheKey = event.path.split('?')[0]
  const cache = useStorage('ipxCache')

  const cached = await cache.getItem<CachedImage>(cacheKey)
  if (cached) {
    if (etagMatches(event.headers.get('if-none-match'), cached.headers.etag)) {
      const { 'content-length': _contentLength, ...headers } = cached.headers
      setResponseHeaders(event, headers)
      setResponseStatus(event, 304)
      return null
    }
    setResponseHeaders(event, cached.headers)
    return Buffer.from(cached.body, 'base64')
  }

  const response = await serveImage(toWebRequest(event))
  const body = Buffer.from(await response.arrayBuffer())
  const headers = Object.fromEntries(response.headers.entries())

  if (response.status === 200 && body.length > 0) {
    await cache.setItem(cacheKey, { headers, body: body.toString('base64') })
  }

  setResponseHeaders(event, headers)
  setResponseStatus(event, response.status)
  return body
})
