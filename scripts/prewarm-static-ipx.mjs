#!/usr/bin/env node

/**
 * Generic Nuxt Image/IPX prewarmer.
 *
 * Usage in a built Nuxt application:
 *   PREWARM_ROUTES=/,/about node scripts/prewarm-static-ipx.mjs
 *
 * Set PREWARM_ORIGIN when a server is already running. Otherwise this script
 * starts .output/server/index.mjs, warms the routes, and shuts it down.
 * PREWARM_IMAGE_URLS may contain newline-separated image URLs that are not
 * present in server-rendered HTML (for example, client-only image lists).
 */

import { spawn } from 'node:child_process'
import { performance } from 'node:perf_hooks'

const port = process.env.PREWARM_PORT ?? '3201'
const origin = (process.env.PREWARM_ORIGIN ?? `http://127.0.0.1:${port}`).replace(/\/$/, '')
const routes = parseList(process.env.PREWARM_ROUTES ?? '/')
const explicitImageURLs = parseList(process.env.PREWARM_IMAGE_URLS ?? '')
const imagePrefixes = parseList(process.env.PREWARM_IMAGE_PREFIXES ?? '/_ipx/')
const concurrency = Number(process.env.PREWARM_CONCURRENCY ?? 4)
const startServer = !process.env.PREWARM_ORIGIN

function parseList(value) {
  return value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function absoluteURL(value) {
  const decoded = value.replaceAll('&amp;', '&')
  try {
    return new URL(decoded, `${origin}/`).toString()
  }
  catch {
    return undefined
  }
}

function discoverImageURLs(html) {
  const urls = new Set()
  const pattern = /(?:src|srcset|href)=["']([^"']+)["']/gi
  for (const match of html.matchAll(pattern)) {
    for (const candidate of match[1].split(',')) {
      const value = candidate.trim().split(/\s+/)[0]
      if (imagePrefixes.some(prefix => value.includes(prefix))) {
        const url = absoluteURL(value)
        if (url) urls.add(url)
      }
    }
  }
  return urls
}

async function waitUntilHealthy() {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return
    }
    catch {
      // The server may still be binding its listener.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('prewarm server did not become healthy within 60 seconds')
}

async function fetchRoutes() {
  const discovered = new Set()
  for (const route of routes) {
    const response = await fetch(absoluteURL(route), { signal: AbortSignal.timeout(30_000) })
    const html = await response.text()
    if (!response.ok) throw new Error(`route failed: ${response.status} ${route}`)
    for (const url of discoverImageURLs(html)) discovered.add(url)
  }
  for (const value of explicitImageURLs) {
    const url = absoluteURL(value)
    if (url) discovered.add(url)
  }
  return [...discovered]
}

async function warmURLs(urls) {
  let next = 0
  let completed = 0

  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      await response.arrayBuffer()
      if (!response.ok) throw new Error(`image failed: ${response.status} ${url}`)
      completed++
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker))
  return completed
}

let server
let stderr = ''
if (startServer) {
  server = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: {
      ...process.env,
      CACHE_WARMUP: '0',
      NITRO_PORT: port,
      PORT: port,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  server.stderr.on('data', (data) => {
    stderr += data.toString()
  })
}

const started = performance.now()
try {
  if (startServer) await waitUntilHealthy()
  const imageURLs = await fetchRoutes()
  const completed = await warmURLs(imageURLs)
  console.info(
    `[nuxt-image-prewarm] routes=${routes.length} images=${completed} `
    + `elapsed=${(performance.now() - started).toFixed(0)}ms`,
  )
}
catch (error) {
  console.error(error)
  if (stderr) console.error(stderr)
  process.exitCode = 1
}
finally {
  if (server) {
    server.kill('SIGTERM')
    setTimeout(() => server.kill('SIGKILL'), 5_000).unref()
  }
}
