import type { Ref } from 'vue'

/**
 * Tracks an element's rendered width, for SVG charts that draw at real pixel
 * sizes rather than scaling a fixed viewBox.
 *
 * A scaled viewBox is the easier option and the wrong one here: stretching it
 * to fit the card stretches the axis labels with it, so the same chart renders
 * with squashed text on a phone and bloated text on a desktop. Measuring
 * instead keeps every stroke width and font size literal.
 *
 * `fallback` is what SSR and the first tick before layout report — the charts
 * render at that width on the server and swap to the measured one on mount,
 * which is invisible because the container is full-width either way.
 *
 * Deliberately hand-rolled rather than pulled from VueUse: VueUse is only
 * present here as a transitive dependency of `@nuxt/ui`, so importing it in app
 * code would be relying on pnpm hoisting that isn't guaranteed.
 */
export function useElementWidth(
  element: Ref<HTMLElement | null>,
  fallback = 640,
): Ref<number> {
  const width = ref(fallback)

  onMounted(() => {
    if (!element.value || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0
      // A container that is momentarily zero-width (a hidden tab, a card still
      // animating in) would otherwise collapse the chart to nothing.
      if (measured > 0) width.value = measured
    })

    observer.observe(element.value)
    onBeforeUnmount(() => observer.disconnect())
  })

  return width
}
