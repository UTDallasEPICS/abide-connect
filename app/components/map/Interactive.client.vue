<template>
  <MglMap
    :map-style="style"
    :center="center"
    :zoom="zoom"
    :attribution-control="false"
  >
    <!-- <MglNavigationControl /> -->
    <MglMarker
      :coordinates="[center[0], center[1]]"
      color="#FF0000"
    />
  </MglMap>
</template>

<script lang="ts" setup>
/**
 * MapLibre map with a single marker at its centre.
 *
 * The `.client.vue` suffix is required, not stylistic: maplibre-gl reaches for
 * `window` at import time and throws during SSR. Nuxt only ever mounts this in
 * the browser, so it renders nothing on the server — parents should leave room
 * for it rather than sizing to its content, or the layout will shift on
 * hydration.
 *
 * Follow the same pattern for any other browser-only integration.
 */
defineProps<{
  style: string
  center: number[]
  zoom: number
}>()
</script>
