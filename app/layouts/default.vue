<script setup lang="ts">
/**
 * Default app shell: top bar, page, and the mobile bottom nav.
 *
 * Used by every page that doesn't opt into another layout. Pages reached from
 * within a flow (event detail, settings sub-pages) generally want `secondary`
 * instead, which swaps the bottom nav for a back button.
 */
</script>

<template>
  <div class="w-screen h-screen items-center">
    <NavTop />
    <slot />
    <NavBottom />
  </div>
</template>
