<script setup lang="ts">
/**
 * Layout for pages reached from within a flow rather than from the bottom nav.
 *
 * Drops the bottom tab bar in favour of `NavSecondaryTop`'s back button, so the
 * user returns the way they came instead of jumping to a tab root. Opt in with
 * `definePageMeta({ layout: 'secondary', backText: '…', backTo: '/…' })`.
 *
 * The wrapper owns the offset that clears the fixed header, so pages render
 * from y=0 of the slot and don't each invent their own `mt-19` / `pt-20`.
 */
</script>

<template>
  <div class="min-h-screen w-full bg-white dark:bg-gray-900">
    <NavSecondaryTop />
    <div class="pt-19">
      <slot />
    </div>
  </div>
</template>
