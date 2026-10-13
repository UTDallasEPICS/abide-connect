#!/usr/bin/env node

const target = process.env.BENCHMARK_URL ?? 'https://abide-connect-stage.npts.tech/'
const count = Number(process.env.BENCHMARK_REQUESTS ?? 4)
const timeoutMs = Number(process.env.BENCHMARK_TIMEOUT_MS ?? 30_000)

if (!Number.isInteger(count) || count < 1) {
  throw new Error(`BENCHMARK_REQUESTS must be a positive integer; received ${count}`)
}

function percentile(values, percentile) {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1)
  return sorted[index]
}

async function timedRequest(url, requestNumber) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'text/html' },
    })
    await response.arrayBuffer()
    const elapsedMs = performance.now() - started
    return {
      request: requestNumber,
      status: response.status,
      elapsedMs,
      cacheControl: response.headers.get('cache-control') ?? '',
      serverTiming: response.headers.get('server-timing') ?? '',
    }
  }
  finally {
    clearTimeout(timeout)
  }
}

const results = []
for (let requestNumber = 1; requestNumber <= count; requestNumber++) {
  results.push(await timedRequest(target, requestNumber))
}

const timings = results.map(result => result.elapsedMs)
const warmTimings = timings.slice(1)

console.log(`Target: ${target}`)
console.log(`Requests: ${count}; timeout: ${timeoutMs} ms`)
console.table(results.map(result => ({
  request: result.request,
  status: result.status,
  ms: result.elapsedMs.toFixed(1),
  cacheControl: result.cacheControl,
})))
console.log(JSON.stringify({
  target,
  count,
  firstMs: timings[0],
  warmAverageMs: warmTimings.length
    ? warmTimings.reduce((sum, value) => sum + value, 0) / warmTimings.length
    : timings[0],
  p50Ms: percentile(timings, 50),
  p95Ms: percentile(timings, 95),
  results,
}, null, 2))
