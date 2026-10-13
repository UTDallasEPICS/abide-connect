/**
 * Populate the process-local Nitro and IPX caches after a production process
 * starts. This is deliberately best-effort: cache warming must never delay
 * readiness or make an otherwise healthy task fail.
 */

const PUBLIC_ROUTES = [
  '/',
  '/mobileClinic',
  '/api/events/upcoming',
  '/api/events/today',
  '/api/events/week',
  '/api/events/by-day',
  '/api/events/training',
  '/api/mobile-clinic/schedule',
]

const LANDING_IMAGES = [
  '/images/image2.jpg',
  '/images/image1.png',
  '/images/image3.JPG',
  '/images/PrenatalCare.png',
  '/images/PostpartumCare.png',
  '/images/ChildbirthEducation.png',
  '/images/Donate.png',
]

const WARMUP_TIMEOUT_MS = 15_000
const STARTUP_TIMEOUT_MS = 30_000
const CONCURRENCY = 2

function localOrigin(): string {
  const port = process.env.NITRO_PORT || process.env.PORT || '3000'
  return `http://127.0.0.1:${port}`
}

function imageURLs(origin: string): string[] {
  return LANDING_IMAGES.map((path) => {
    // 640 is the smallest canonical IPX width and warms the most common
    // mobile/landing-page variant without multiplying startup work.
    const encodedPath = path
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')
    return `${origin}/_ipx/f_webp&q_80&s_640x640${encodedPath}`
  })
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WARMUP_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/html, image/webp, */*' },
    })
  }
  finally {
    clearTimeout(timeout)
  }
}

async function waitUntilListening(origin: string): Promise<boolean> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(`${origin}/api/health`)
      if (response.ok) return true
    }
    catch {
      // The Nitro listener may not be bound yet. Retry until the deadline.
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  return false
}

async function warmURLs(urls: string[]): Promise<{ succeeded: number, failed: number }> {
  let next = 0
  let succeeded = 0
  let failed = 0

  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]
      try {
        const response = await fetchWithTimeout(url)
        await response.arrayBuffer()
        if (response.ok) succeeded++
        else failed++
      }
      catch {
        failed++
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))
  return { succeeded, failed }
}

async function warmCaches() {
  const origin = localOrigin()
  if (!await waitUntilListening(origin)) {
    console.warn(`[cache-warmup] server did not become reachable within ${STARTUP_TIMEOUT_MS}ms`)
    return
  }

  const routes = await warmURLs(PUBLIC_ROUTES.map(path => `${origin}${path}`))
  const images = await warmURLs(imageURLs(origin))
  console.info(
    `[cache-warmup] routes ${routes.succeeded}/${PUBLIC_ROUTES.length}, `
    + `images ${images.succeeded}/${LANDING_IMAGES.length}`,
  )
}

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production' && process.env.CACHE_WARMUP === '1') {
    void warmCaches()
    return
  }
  if (process.env.NODE_ENV === 'production' && process.env.CACHE_WARMUP !== '0') {
    void warmCaches()
  }
})
