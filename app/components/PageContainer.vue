<script setup lang="ts">
/**
 * The app's one horizontal gutter and content width.
 *
 * Every page's content sits in one of these rather than hand-rolling
 * `px-5 lg:px-10` / `mx-10` / `px-4` / `p-8` and picking a `max-w-*` per page.
 * The gutter matches `@nuxt/ui`'s own `UContainer` (`px-4 sm:px-6 lg:px-8`), so
 * a page that reaches for a kit component lands on the same rhythm.
 *
 * Vertical space is not this component's business — the layouts own the offsets
 * that clear the fixed bars, and sections own the gaps between themselves.
 *
 * A full-bleed band (a coloured strip that must span the viewport) goes
 * *outside* a container, as a sibling; see `pages/index.vue`.
 */
type ContainerWidth = 'full' | 'wide' | 'content' | 'narrow' | 'form'

const props = withDefaults(defineProps<{
  /**
   * - `full` — browse and dashboard pages (80rem, `--ui-container`)
   * - `wide` — reports and wide tables (72rem)
   * - `content` — a single record being read (56rem)
   * - `narrow` — settings, prose, confirmation screens (42rem)
   * - `form` — a centred auth/sign-up card (28rem)
   */
  width?: ContainerWidth
}>(), { width: 'full' })

const widthClass: Record<ContainerWidth, string> = {
  full: 'max-w-(--ui-container)',
  wide: 'max-w-6xl',
  content: 'max-w-4xl',
  narrow: 'max-w-2xl',
  form: 'max-w-md',
}
</script>

<template>
  <div
    class="mx-auto w-full px-4 sm:px-6 lg:px-8"
    :class="widthClass[props.width]"
  >
    <slot />
  </div>
</template>
