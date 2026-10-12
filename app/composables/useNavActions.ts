import { computed, onScopeDispose, shallowRef, toValue, watchEffect } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Page-supplied buttons for the top action bar.
 *
 * The shell owns the chrome, so a page that needs a control up there (the
 * admin edit/save pair on an event) hands the bar a description of the button
 * instead of drawing a second action strip of its own under the header.
 *
 * Native rewrite of the web composable: `ButtonProps`/`@nuxt/ui` types are
 * gone (the native bar renders `ActionItem`s, which only carry text and a tap
 * handler), and the `import.meta.server` guard is dropped — there is no SSR.
 * Module-scope state, cleared when the page's scope is disposed, still gives
 * the same "next route starts with a bare bar" behaviour.
 */
export type NavAction = {
  /** Stable across re-renders — it's the list key. */
  key: string
  label: string
  icon?: string
  color?: string
  variant?: string
  disabled?: boolean
  onSelect: () => void
}

const navActions = shallowRef<NavAction[]>([])

/** Read side, for the shell. */
export function useNavActionsState() {
  return computed(() => navActions.value)
}

/**
 * Write side, for a page. Pass a getter or ref so the set can change with the
 * page (edit mode swaps "Edit Event" for "Cancel"/"Save").
 */
export function useNavActions(source: MaybeRefOrGetter<NavAction[]>) {
  watchEffect(() => {
    navActions.value = toValue(source)
  })

  onScopeDispose(() => {
    navActions.value = []
  })
}
