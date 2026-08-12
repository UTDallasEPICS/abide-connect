<script setup lang="ts">
/**
 * Back-button header for the `secondary` layout.
 *
 * Uses `router.back()` rather than a fixed parent route, so the user returns
 * wherever they came from. The caveat is that a page opened directly (deep
 * link, refresh) has no history to go back to and the button does nothing.
 *
 * The label beside the arrow comes from the page's own
 * `definePageMeta({ backText: '…' })`, and is omitted when unset.
 */
const router = useRouter()
const route = useRoute()
</script>

<template>
  <UHeader
    :ui="{
      toggle: 'hidden',
      root: 'border-b-0 shadow-none',
    }"
    class="text-teal-700 dark:text-teal-400 fixed top-0 z-50 h-19 w-full bg-white dark:bg-gray-900"
  >
    <template #left>
      <UButton
        color="neutral"
        variant="ghost"
        class="gap-1"
        @click="router.back()"
      >
        <span class="text-lg">&lt;</span>
      </UButton>

      <span
        v-if="route.meta.backText"
        class="font-normal"
      >
        {{ route.meta.backText }}
      </span>
    </template>

    <template #toggle />
  </UHeader>
</template>
