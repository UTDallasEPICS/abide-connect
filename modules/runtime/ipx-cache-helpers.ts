export const IPX_BASE_URL = '/_ipx'

/**
 * The only widths the image handler will ever encode. Every request whose
 * `s_widthxheight` modifier is not already on this ladder is rounded **up**
 * to the next step (or capped at the top step), so a given source image can
 * never produce more than these four variants. Everything the page emits —
 * `screens xs..xxl` at 1x/2x — collapses onto this set.
 */
export const VARIANT_WIDTH_LADDER = [640, 1024, 1280, 2048]

export interface VariantSize {
  width: number
  height: number
}

export interface CachedImage {
  headers: Record<string, string>
  body: Buffer
}

export const SIZE_MODIFIER_RE = /s_(\d{1,5})x(\d{1,5})/

const MODS_START = IPX_BASE_URL.length + 1

export function canonicalSize(width: number, height: number): VariantSize {
  let canonicalWidth = VARIANT_WIDTH_LADDER.find(step => step >= width)
  if (canonicalWidth === undefined) {
    canonicalWidth = VARIANT_WIDTH_LADDER[VARIANT_WIDTH_LADDER.length - 1]
  }
  // Quantise the height to multiples of two. Requests for the same source at
  // different widths round to minute height differences (720 vs 721) that would
  // otherwise fork the cache key past the four-variant budget.
  const canonicalHeight = Math.max(2, Math.floor(((height * canonicalWidth) / width / 2)) * 2)
  return { width: canonicalWidth, height: canonicalHeight }
}

/**
 * Rewrites the size modifier of an `/_ipx/...` path to the nearest ladder
 * step. Paths that do not look like `/_ipx/<modifiers>/<file>` (or already
 * carry a ladder width) are returned unchanged.
 */
export function canonicalizeIPXPath(path: string): string {
  if (!path.startsWith(`${IPX_BASE_URL}/`)) {
    return path
  }
  const modsEnd = path.indexOf('/', MODS_START)
  if (modsEnd === -1) {
    return path
  }
  const mods = path.slice(MODS_START, modsEnd)
  const match = SIZE_MODIFIER_RE.exec(mods)
  if (!match) {
    return path
  }
  const requestedWidth = Number(match[1])
  const requestedHeight = Number(match[2])
  const canonical = canonicalSize(requestedWidth, requestedHeight)
  if (canonical.width === requestedWidth && canonical.height === requestedHeight) {
    return path
  }
  const canonicalMods = mods.replace(match[0], `s_${canonical.width}x${canonical.height}`)
  return `${path.slice(0, MODS_START)}${canonicalMods}${path.slice(modsEnd)}`
}

export interface LRUEntry {
  headers: Record<string, string>
  body: Buffer
  bytes: number
}

const ENTRY_OVERHEAD = 512

/**
 * In-memory image cache, bounded by total bytes (not entry count). Holds the
 * decoded response buffer so a hit is a Map lookup + a copied header object —
 * no fs, no JSON, no base64.
 */
export class ByteCappedLRU {
  private readonly entries = new Map<string, LRUEntry>()
  private totalBytes = 0

  constructor(
    private readonly maxBytes: number,
  ) {}

  get(key: string): LRUEntry | undefined {
    const entry = this.entries.get(key)
    if (!entry) {
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry
  }

  set(key: string, headers: Record<string, string>, body: Buffer): void {
    const bytes = body.byteLength + ENTRY_OVERHEAD
    if (bytes > this.maxBytes && !this.entries.has(key)) {
      return
    }
    const existing = this.entries.get(key)
    if (existing) {
      this.totalBytes -= existing.bytes
      this.entries.delete(key)
    }
    this.entries.set(key, { headers, body, bytes })
    this.totalBytes += bytes
    this.evict()
  }

  private evict(): void {
    while (this.totalBytes > this.maxBytes && this.entries.size > 1) {
      const oldestKey = this.entries.keys().next().value as string
      const oldest = this.entries.get(oldestKey) as LRUEntry
      this.totalBytes -= oldest.bytes
      this.entries.delete(oldestKey)
    }
  }

  delete(key: string): void {
    const entry = this.entries.get(key)
    if (entry) {
      this.totalBytes -= entry.bytes
      this.entries.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
    this.totalBytes = 0
  }

  get size(): number {
    return this.entries.size
  }

  get bytes(): number {
    return this.totalBytes
  }
}
