<script setup lang="ts">
const onSettingsClick = () => navigateTo('/settings')

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
      root: 'border-none',
    }"
    :toggle="false"
    class="fixed top-0 z-50 py-5 h-auto w-full dark:bg-gray-900 transition-shadow duration-200 bg-white/90 backdrop-blur-lg"
    :class="isScrolled ? 'shadow-sm' : 'shadow-none'"
  >
    <template #left>
      <NuxtLink
        to="/"
        aria-label="Go to home page"
      >
        <img
          src="/images/abide_logo.svg"
          alt="Abide logo"
          class="h-9 w-auto cursor-pointer"
        >
      </NuxtLink>
    </template>
    <template #right>
      <div class="flex items-center gap-0.5">
        <slot name="right">
          <NavNotificationMenu />
          <UButton
            color="neutral"
            variant="ghost"
            aria-label="Settings"
            @click="onSettingsClick"
          >
            <UIcon
              name="i-lucide-settings"
              class="w-6 h-6 text-gray-900 dark:text-teal-400"
            />
          </UButton>
        </slot>
      </div>
    </template>
    <template #toggle />
  </UHeader>
</template>
