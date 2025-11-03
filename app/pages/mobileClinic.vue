<template>
  <div class="w-screen h-screen bg-gray-100 items-center">
    <TopNav />

    <!-- Map Section -->
    <div id="mapbox" class="pt-12 pb-8 h-full w-full">
      <div id="map" class="h-full w-full relative overflow-hidden">
        <AbideMap :style="style" :center="center" :zoom="zoom" />
        <UDrawer
          class="absolute bottom-4 w-11/12 left-1/2 -translate-x-1/2"
          :default-open="true"
          :handle-only="true"
          :dismissible="false"
          :overlay="false"
          :swipe-to-close="true"
          :close-on-escape="false"
          :close-on-click-outside="false"
          :modal="false"
          portal="#map"
          :snap-points="snapPoints"
            >
          <template #content>
            <EventTile class="w-11/12 mx-auto my-4" />
            <EventTile class="w-11/12 mx-auto my-4" />
            <EventTile class="w-11/12 mx-auto my-4" />
          </template>
        </UDrawer>
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup>
import 'maplibre-gl/dist/maplibre-gl.css';
import EventTile from '~/components/EventTile.vue';

const style = '/mapstyles.json'
const center = [-96.77049780046936, 32.772891246510596]
const zoom = 15

// Pixel values
const snapPoints = ["230", "340", "450"]

</script>