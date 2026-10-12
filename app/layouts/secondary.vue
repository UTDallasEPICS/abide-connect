<script setup lang="ts">
/**
 * The `secondary` layout, native.
 *
 * A detour screen (login, a form) rather than a tab destination: app bar with
 * a back control and no bottom nav, via `AppShell variant="secondary"`.
 *
 *     <SecondaryLayout title="Sign in"> … </SecondaryLayout>
 */
import AppShell from '~/components/native/AppShell.vue'

withDefaults(defineProps<{
  title?: string
  backText?: string
  scrollable?: boolean
}>(), {
  backText: 'Back',
})
</script>

<template>
  <AppShell
    variant="secondary"
    :title="title"
    :back-text="backText"
    :scrollable="scrollable"
  >
    <slot />
  </AppShell>
</template>
