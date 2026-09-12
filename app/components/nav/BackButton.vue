<script setup lang="ts">
/**
 * The platform's one back control, shared by both headers.
 *
 * `NavSecondaryTop` always renders it; `NavTop` renders it on pages that
 * declare `backTo`, so a detail page pushed inside a tab keeps the tab bar and
 * still offers a way back. Living in one component keeps the two headers from
 * drifting into two different arrows with two different behaviours.
 *
 * `router.back()` returns the user wherever they actually came from, which is
 * the point — the same page is reached from several places. A page opened cold
 * (deep link, emailed event, refresh) has nothing to pop, so instead of doing
 * nothing the button falls back to `definePageMeta({ backTo: '/…' })`.
 *
 * `backText` supplies the optional label; it's part of the button so the whole
 * target is tappable rather than just the arrow.
 */
const router = useRouter()
const route = useRoute()

function goBack() {
  // vue-router records the previous entry on history state; it's absent when
  // this page is the first entry in the tab.
  if (window.history.state?.back) {
    router.back()
    return
  }
  return navigateTo(route.meta.backTo ?? '/')
}
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    icon="i-lucide-arrow-left"
    class="-ml-2 gap-2 text-teal-700 dark:text-teal-400"
    :aria-label="route.meta.backText ? `Back to ${route.meta.backText}` : 'Go back'"
    @click="goBack"
  >
    <span
      v-if="route.meta.backText"
      class="font-medium"
    >
      {{ route.meta.backText }}
    </span>
  </UButton>
</template>
