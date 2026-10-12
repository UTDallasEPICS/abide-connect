<script setup lang="ts">
/**
 * The `default` layout, native.
 *
 * There is no `<NuxtLayout>` natively, so a "layout" is just a wrapper a page
 * imports and surrounds itself with. This one is the app chrome: app bar plus
 * the bottom tab bar, via `AppShell variant="default"`.
 *
 *     <DefaultLayout title="Abide Connect"> … </DefaultLayout>
 */
import AppShell from '~/components/native/AppShell.vue'

defineProps<{
  title?: string
  scrollable?: boolean
}>()
</script>

<template>
  <AppShell
    variant="default"
    :title="title"
    :scrollable="scrollable"
  >
    <slot />
  </AppShell>
</template>
