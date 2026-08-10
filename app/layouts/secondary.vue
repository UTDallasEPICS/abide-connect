<script setup lang="ts">
/**
 * Layout for pages reached from within a flow rather than from the nav.
 *
 * Drops the bottom nav in favour of `NavSecondaryTop`'s back button, so the
 * user returns the way they came instead of jumping to a tab root. Opt in with
 * `definePageMeta({ layout: 'secondary' })`.
 */
</script>

<template>
  <div class="w-screen h-full items-center bg-white dark:bg-gray-900">
    <NavSecondaryTop />
    <slot />
  </div>
</template>
