<template>
  <MglMap
    :map-style="mapStyle"
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
 * the browser, so it renders nothing on the server — parents must give it a
 * container with a *definite* height, because MglMap sizes itself `height: 100%`
 * and a chain of percentage heights over an auto-height ancestor collapses to
 * zero, leaving a blank page rather than a map.
 *
 * The style prop is `mapStyle`, not `style`: Vue normalises `style` as an inline
 * CSS binding before a component ever sees it, so a URL passed that way is
 * parsed as declarations, comes out empty, and the map loads no style at all.
 *
 * Follow the same pattern for any other browser-only integration.
 */
defineProps<{
  mapStyle: string
  center: number[]
  zoom: number
}>()
</script>
