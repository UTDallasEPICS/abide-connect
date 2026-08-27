<script setup lang="ts">
/**
 * Default app shell: top bar, page, and the mobile bottom nav.
 *
 * Used by every page that doesn't opt into another layout: the bottom-nav
 * destinations and the events browse pages under them. Pages reached from within
 * a flow (settings sub-pages, event management) want `secondary` instead, which
 * swaps the bottom nav for a back button.
 *
 * The wrapper owns the offsets that clear the two fixed bars, so pages render
 * from y=0 of the slot instead of each inventing their own `mt-20` / `pt-24` /
 * `pb-24`. `pt-25` is `NavTop`'s 4.75rem plus 1.5rem of breathing room; `pb-16`
 * is `NavBottom`'s 3rem plus 1rem. `secondary` uses the same pair, so the two
 * shells start and end a page identically.
 *
 * `main` is a flex column that fills the viewport, so a page that wants to
 * centre itself in what's left of the screen uses `flex-1` on its root rather
 * than re-deriving `min-h-[calc(100vh-4.75rem)]`.
 */
</script>

<template>
  <div class="flex min-h-screen w-full flex-col bg-white dark:bg-gray-900">
    <NavTop />
    <main class="flex flex-1 flex-col pt-25 pb-16">
      <slot />
    </main>
    <NavBottom />
  </div>
</template>
