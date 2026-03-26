<template>
    <!-- Map Section -->
    <div id="mapbox" class="pt-12 pb-12 h-full w-full">
      <div id="map" class="h-full w-full relative overflow-hidden">
        <MapInteractive :style="style" :center="center" :zoom="zoom" />
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
            <EventTile
v-if ="pastEvents.length === 0"
              class="w-11/12 mx-auto my-4 cursor-pointer"
              title="No past events"
              subtitle="Check back later for updates!"
              
            />
            <EventTile
v-for="event in pastEvents"
              v-else
              :key="event.id"
              class="w-11/12 mx-auto my-4 cursor-pointer"
              :title="event.title"
              :subtitle="new Date(event.startTime).toLocaleString()"
              @click="() => mapAdjust(event)"
            />
          </template>
        </UDrawer>
      </div>
    </div>
</template>

<script setup>
import 'maplibre-gl/dist/maplibre-gl.css';

const style = '/mapstyles.json'
const center = ref([-96.77049780046936, 32.772891246510596])
const zoom = ref(15)

// Pixel values
const snapPoints = ["230", "340", "450"]

const pastEvents = ref([])
const upcomingEvents = ref([])

// Load all events from API on mount
onMounted(async () => {
  console.log('✅ Page mounted - Loading events from API')
  await loadEvents()
})

async function loadEvents() {
  try {
    const allEvents = await $fetch('/api/events')
    console.log('✅ Loaded events from API:', allEvents)
    
    const now = new Date()
    
    pastEvents.value = allEvents.filter(event => {
      const endTime = new Date(event.endTime)
      return endTime < now
    })
    
    upcomingEvents.value = allEvents.filter(event => {
      const endTime = new Date(event.endTime)
      return endTime >= now
    })
    
    console.log('📅 Past events:', pastEvents.value.length)
    console.log('📅 Upcoming events:', upcomingEvents.value.length)
    
  } catch (error) {
    console.error('❌ Error loading events:', error)
  }
}


async function mapAdjust() {

  const lng = -96.749788
  const lat = 32.985141
  
  center.value = [lng, lat]
  zoom.value = 17
}

</script>