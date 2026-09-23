/**
 * Which @nuxt/image provider can handle an event card's image.
 *
 * Event cards receive one of two kinds of `src`:
 *
 *  - `/images/default-event.jpg` — a real file in `public/`, which the
 *    default `ipx` provider can resize and re-encode to webp.
 *  - `/api/events/<id>/images/<name>` — a Nitro route streaming a file from
 *    `IMAGE_STORAGE_PATH`, which is typically a mounted volume outside
 *    `public/`. ipx resolves relative paths against `public/`, so handing it
 *    this URL produces a 404 and a broken card.
 *
 * `'none'` passes the src through untouched while still letting the component
 * stay a single `<NuxtImg>` with consistent `loading` / `decoding` / sizing.
 * Uploaded images get their savings from the resize in
 * `server/api/events/[id]/images/upload.post.ts` and the cache headers in the
 * matching `[name].get.ts` instead.
 */
export function eventImageProvider(src: string): 'none' | undefined {
  return src.startsWith('/api/') ? 'none' : undefined
}
