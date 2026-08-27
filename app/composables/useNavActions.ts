import type { ButtonProps } from '@nuxt/ui'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Page-supplied buttons for the top bar.
 *
 * The shell owns the chrome, so a page that needs a control up there (the
 * admin edit/save pair on an event) hands the bar a description of the button
 * instead of drawing a second action strip of its own under the header. That
 * strip was a full-width band that showed up for admins only and left the page
 * pushed down by an otherwise empty row.
 *
 * `label` is always the accessible name; it collapses to the icon alone on
 * narrow screens, so give every action an `icon`.
 */
export type NavAction = {
  /** Stable across re-renders — it's the list key. */
  key: string
  label: string
  icon?: string
  color?: ButtonProps['color']
  variant?: ButtonProps['variant']
  disabled?: boolean
  onSelect: () => void
}

/**
 * Client-only module state rather than `useState`, for two reasons: the actions
 * carry callbacks, which can't go through the SSR payload, and per-request
 * server state would leak between requests. The headers render before the page
 * either way (they're the layout's first child), so there is nothing to place
 * server-side — the buttons appear with the page's own first client render.
 */
const navActions = shallowRef<NavAction[]>([])

/** Read side, for the headers. */
export function useNavActionsState() {
  return computed(() => navActions.value)
}

/**
 * Write side, for a page. Pass a getter or ref so the set can change with the
 * page (edit mode swaps "Edit Event" for "Cancel"/"Save"). Cleared when the
 * page goes away, so the next route starts with a bare bar.
 */
export function useNavActions(source: MaybeRefOrGetter<NavAction[]>) {
  if (import.meta.server) return

  watchEffect(() => {
    navActions.value = toValue(source)
  })

  onScopeDispose(() => {
    navActions.value = []
  })
}
