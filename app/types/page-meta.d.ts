/**
 * Page-meta keys read by `NavBackButton`, the shared back control in both
 * headers.
 *
 * `secondary` pages always get the arrow; on a `default` page, declaring
 * `backTo` is what puts one in `NavTop` — so it doubles as the switch for
 * pages that sit inside a tab rather than being its root.
 *
 * Declared here so a typo in `definePageMeta` is a type error rather than a
 * back button that silently loses its label or its deep-link fallback.
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** Label shown beside the back arrow. Omit for an icon-only button. */
    backText?: string
    /**
     * Where to go when there is no history to pop — a deep link, an emailed
     * link, or a refresh. Defaults to `/`.
     */
    backTo?: string
  }
}

export {}
