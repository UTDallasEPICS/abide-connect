<script setup lang="ts">
/**
 * Layout for pages reached from within a flow rather than from the bottom nav.
 *
 * Drops the bottom tab bar in favour of `NavSecondaryTop`'s back button, so the
 * user returns the way they came instead of jumping to a tab root. Opt in with
 * `definePageMeta({ layout: 'secondary', backText: '…', backTo: '/…' })`.
 *
 * The wrapper owns the offset that clears the fixed header, so pages render
 * from y=0 of the slot and don't each invent their own `mt-19` / `pt-20`. The
 * `pt-25` / `pb-16` pair is `default`'s, so the two shells start and end a page
 * identically even though there's no bottom bar here to clear.
 *
 * `main` is a flex column that fills the viewport, so a page that wants to
 * centre itself in what's left of the screen uses `flex-1` on its root rather
 * than re-deriving `min-h-[calc(100vh-4.75rem)]`.
 */
</script>

<template>
  <div class="flex min-h-screen w-full flex-col bg-white dark:bg-gray-900">
    <NavSecondaryTop />
    <main class="flex flex-1 flex-col pt-25 pb-16">
      <slot />
    </main>
  </div>
</template>
