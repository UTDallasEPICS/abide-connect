<script setup lang="ts">
/**
 * The platform's one back-button header, shown by the `secondary` layout.
 *
 * Every page except the five bottom-nav destinations (home, events, mobile
 * clinic, volunteer dashboard, admin dashboard) opts into `secondary`, so the
 * control sits in the same place at the same size everywhere and pages don't
 * hand-roll their own arrow.
 *
 * `router.back()` returns the user wherever they actually came from, which is
 * the point — the same page is reached from several places. A page opened cold
 * (deep link, emailed event, refresh) has nothing to pop, so instead of doing
 * nothing the button falls back to `definePageMeta({ backTo: '/…' })`.
 *
 * `backText` supplies the optional label; it's part of the button so the whole
 * target is tappable rather than just the arrow.
 *
 * Height and chrome match `NavTop` (h-19, translucent, shadow on scroll) so the
 * two headers read as the same bar.
 */
const router = useRouter()
const route = useRoute()

const isScrolled = ref(false)
const handleScroll = () => {
  isScrolled.value = window.scrollY > 0
}
onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

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
  <UHeader
    :ui="{
      toggle: 'hidden',
      root: 'border-none',
    }"
    :toggle="false"
    class="fixed top-0 z-50 h-19 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg transition-shadow duration-200"
    :class="isScrolled ? 'shadow-sm' : 'shadow-none'"
  >
    <template #left>
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

    <template #toggle />
  </UHeader>
</template>
