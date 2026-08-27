<script setup lang="ts">
/**
 * Back-button header shown by the `secondary` layout.
 *
 * Pages reached from within a flow (settings sub-pages, the volunteer
 * application, admin sub-pages) opt into `secondary`, which drops the bottom
 * tab bar: those screens are a detour out of the tabs, so the only way onward
 * is back. The tab destinations and the events browse pages under them use
 * `default` instead and get the back control from `NavTop`.
 *
 * The arrow itself is `NavBackButton`, shared with `NavTop`, and the right of
 * the bar carries whatever the page registered with `useNavActions`, same as
 * there.
 *
 * Height and chrome match `NavTop` (h-19, translucent, shadow on scroll) so the
 * two headers read as the same bar.
 */
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
      <NavBackButton />
    </template>

    <template #right>
      <div class="flex items-center gap-0.5">
        <NavActions />
      </div>
    </template>

    <template #toggle />
  </UHeader>
</template>
