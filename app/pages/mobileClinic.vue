<template>
  <div class="min-h-screen bg-gray-100 flex justify-center py-6">
    <!-- Phone container -->
    <div class="w-[375px] bg-white rounded-3xl shadow-lg overflow-hidden flex flex-col max-h-[812px] overflow-y-auto">
      <TopNav />

      <!-- Map Section -->
      <div class="h-full w-full relative">
        <Map :style="style" :center="center" :zoom="zoom" />
        <UDashboardSearchButton :kbds="[]" class="absolute inset-2 h-10" />
        <div class="absolute bottom-4 w-90">
          <EventTile class="w-90 mx-2 my-4" />
          <EventTile class="w-90 mx-2 my-4" />
          <EventTile class="w-90 mx-2 my-4" />
        </div>
      </div>

      <!-- Bottom nav dots -->
      <div class="flex justify-around items-center py-3 border-t">
        <span class="w-4 h-4 rounded-full bg-black"></span>
        <span class="w-4 h-4 rounded-full border border-black"></span>
        <span class="w-4 h-4 rounded-full border border-black"></span>
        <span class="w-4 h-4 rounded-full border border-black"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import 'maplibre-gl/dist/maplibre-gl.css';
import EventTile from '~/components/EventTile.vue';
const style = 'https://tiles.openfreemap.org/styles/liberty'
const center = [-96.77049780046936, 32.772891246510596]
const zoom = 15


</script>