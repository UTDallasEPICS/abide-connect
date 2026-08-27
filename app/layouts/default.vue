<script setup lang="ts">
/**
 * Default app shell: top bar, page, and the mobile bottom nav.
 *
 * Used by every page that doesn't opt into another layout: the bottom-nav
 * destinations and the events browse pages under them. Pages reached from within
 * a flow (settings sub-pages, event management) want `secondary` instead, which
 * swaps the bottom nav for a back button.
 */
</script>

<template>
  <div class="min-w-screen min-h-screen items-center">
    <NavTop />
    <slot />
    <NavBottom />
  </div>
</template>
