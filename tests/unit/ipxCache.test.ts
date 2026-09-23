import { describe, expect, it } from 'vitest'
import {
  ByteCappedLRU,
  VARIANT_WIDTH_LADDER,
  canonicalSize,
  canonicalizeIPXPath,
} from '../../modules/runtime/ipx-cache-helpers'

describe('canonicalSize', () => {
  it('keeps widths already on the ladder', () => {
    for (const step of VARIANT_WIDTH_LADDER) {
      expect(canonicalSize(step, Math.round(step * 9 / 16)).width).toBe(step)
    }
  })

  it('rounds sub-ladder widths up to the smallest covering step', () => {
    expect(canonicalSize(320, 180).width).toBe(640)
    expect(canonicalSize(768, 432).width).toBe(1024)
  })

  it('caps widths above the ladder at the top step', () => {
    expect(canonicalSize(2560, 1440).width).toBe(2048)
    expect(canonicalSize(4032, 3024).width).toBe(2048)
  })

  it('preserves the requested aspect ratio', () => {
    expect(canonicalSize(768, 432)).toEqual({ width: 1024, height: 576 })
    expect(canonicalSize(1280, 720)).toEqual({ width: 1280, height: 720 })
  })

  it('same-aspect requests converge on one canonically sized key', () => {
    expect(canonicalSize(750, 422)).toEqual(canonicalSize(828, 466))
    expect(canonicalSize(1080, 608)).toEqual(canonicalSize(1280, 720))
  })
})

describe('canonicalizeIPXPath', () => {
  const imagePath = '/images/image2.jpg'

  it('returns paths without a size modifier unchanged', () => {
    expect(canonicalizeIPXPath(`/_ipx/f_webp&q_80${imagePath}`)).toBe(`/_ipx/f_webp&q_80${imagePath}`)
    expect(canonicalizeIPXPath('/api/events/1/images/a.jpg')).toBe('/api/events/1/images/a.jpg')
  })

  it('leaves ladder sizes untouched so repeats hit the same key', () => {
    const path = `/_ipx/f_webp&q_80&s_1280x720${imagePath}`
    expect(canonicalizeIPXPath(path)).toBe(path)
  })

  it('normalises off-ladder sizes onto the cache key', () => {
    expect(canonicalizeIPXPath(`/_ipx/f_webp&q_80&s_768x432${imagePath}`)).toBe(`/_ipx/f_webp&q_80&s_1024x576${imagePath}`)
    expect(canonicalizeIPXPath(`/_ipx/f_webp&q_80&s_2048x1152${imagePath}`)).toBe(`/_ipx/f_webp&q_80&s_2048x1152${imagePath}`)
  })

  it('never produces more than four canonical paths per image', () => {
    const requestedWidths = [320, 375, 640, 750, 828, 1080, 1280, 1536, 2048, 2560]
    const canonical = new Set(requestedWidths.map(width => canonicalizeIPXPath(`/_ipx/f_webp&q_80&s_${width}x${Math.round(width * 9 / 16)}${imagePath}`)))
    expect(canonical.size).toBeLessThanOrEqual(VARIANT_WIDTH_LADDER.length)
  })
})

describe('ByteCappedLRU', () => {
  // Each entry carries ENTRY_OVERHEAD (512B) on top of its body bytes, so a
  // 400-byte body costs 912 bytes under the cap.
  const body = (size: number) => Buffer.alloc(size)

  it('evicts least-recently-used entries first once the byte cap is reached', () => {
    const cache = new ByteCappedLRU(2000)
    cache.set('a', {}, body(400))
    cache.set('b', {}, body(400))
    expect(cache.size).toBe(2)
    cache.set('c', {}, body(400))
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeDefined()
    expect(cache.get('c')).toBeDefined()
  })

  it('a hit refreshes recency so hot keys survive eviction', () => {
    const cache = new ByteCappedLRU(2000)
    cache.set('a', {}, body(400))
    cache.set('b', {}, body(400))
    cache.get('a')
    cache.set('c', {}, body(400))
    expect(cache.get('a')).toBeDefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('replacing a key accounts for the old bytes', () => {
    const cache = new ByteCappedLRU(2000)
    cache.set('a', {}, body(400))
    cache.set('b', {}, body(400))
    cache.set('a', {}, body(700))
    expect(cache.get('a')).toBeDefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('tracks total bytes (bodies plus entry overhead)', () => {
    const cache = new ByteCappedLRU(10_000)
    cache.set('a', {}, body(40))
    cache.set('b', {}, body(60))
    expect(cache.bytes).toBe(40 + 60 + 512 * 2)
  })

  it('an entry larger than the cap is dropped (real variants are ~40-150KB, far under the 64MB budget)', () => {
    const cache = new ByteCappedLRU(100)
    cache.set('a', {}, body(300))
    expect(cache.get('a')).toBeUndefined()
    expect(cache.bytes).toBe(0)
  })

  it('clear empties everything', () => {
    const cache = new ByteCappedLRU(1_000)
    cache.set('a', {}, body(40))
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.bytes).toBe(0)
  })
})
