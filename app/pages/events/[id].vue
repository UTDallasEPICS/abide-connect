<script setup lang="ts">
const route = useRoute()
const { data: event, error } = await useFetch(`/api/events/${route.params.id}`)

if (error.value) console.error(error.value)

const items = [
  'https://picsum.photos/640/640?random=1',
  'https://picsum.photos/640/640?random=2',
  'https://picsum.photos/640/640?random=3',
  'https://picsum.photos/640/640?random=4',
  'https://picsum.photos/640/640?random=5',
  'https://picsum.photos/640/640?random=6'
]

import 'maplibre-gl/dist/maplibre-gl.css';

const style = '/mapstyles.json'
const center = [-96.77049780046936, 32.772891246510596]
const zoom = 15

// Pixel values
const snapPoints = ["230", "340", "450"]

</script>


<template>
  <div v-if="!event">Loading...</div>
  <div v-else>
    <div class="flex flex-col w-full h-full bg-gray-100 items-center">
        <TopNav/>
        <div class="flex-1 mt-4 mb-4 w-full h-full overflow-y-auto"></div>
        <UContainer class="py-10">

          <h1 class="text-3xl font-hornbill font-bold mb-2 text-brand4 text-center">{{ event.title }}</h1>
          <p class="text-gray-600 text-xl font-poppins mb-4 text-center">{{ event.shortDesc }}</p>
          <UCarousel v-slot="{ item }" dots :items="items" class="w-full max-w-xs mx-auto">
            <img :src="item" width="screen" height="320" class="rounded-lg">
          </UCarousel>
          <div class="flex-1 mt-4 mb-10 w-full h-full overflow-y-auto"></div>

          <p class="text-gray-600 font-poppins mb-4">{{ event.description }}</p>

          <div v-if="event.mobileClinicId" class="mt-4 mb-4">
            <p class="text-gray-600 font-poppins">
              This event is part of our Mobile Clinic program. Please visit the clinic for health services and support.
            </p>  
          </div>

          <p class="text-gray-600 font-poppins mb-4">
            📍 {{ event.location }}  
            <br />
            🕒 {{ new Date(event.startTime).toLocaleString() }} → {{ new Date(event.endTime).toLocaleString() }}
          </p>
          
          <div id="map" class="h-full w-full relative overflow-hidden">
            <AbideMap :style="style" :center="center" :zoom="zoom" />
          </div>

          <div class="flex-1 mt-4 mb-2 w-full h-full overflow-y-auto"></div>

          <UContainer>
            <div class="mt-4 text-center">
              <div class="flex gap-4 justify-center">
                <div v-if="event.allowVolunteers" class="flex-1 max-w-xs px-2">
                  <UButton
                    class="w-full bg-brand4 text-white font-poppins rounded-xl py-3"
                    :ui="{ base: 'justify-center' }"
                    size="xl"
                    href="/volunteer/signup"
                  >
                    Volunteer
                  </UButton>
                </div>
                <div v-if="event.allowAttendees" class="flex-1 max-w-xs px-2">
                  <UButton
                    class="w-full bg-brand4 text-white font-poppins rounded-xl py-3"
                    :ui="{ base: 'justify-center' }"
                    size="xl"
                    :href="`/events/${event.id}/register`"
                  >
                    Register
                  </UButton>
                </div>
              </div>
            </div>
          </UContainer>

          <div class="flex-1 mt-4 mb-8 w-full h-full overflow-y-auto"></div>
        
        </UContainer>            
            
        <BottomNav/>
    </div>
  </div>
</template>    


<!-- <template>
  <UContainer class="py-10">
    <div v-if="!event">Loading...</div>
    <div v-else>
      <h1 class="text-3xl font-bold mb-2">{{ event.title }}</h1>
      <p class="text-gray-600 mb-4">{{ event.shortDesc }}</p>
      <p>{{ event.description }}</p>

      <p class="mt-4 text-sm">
        📍 {{ event.location }}  
        <br />
        🕒 {{ new Date(event.startTime).toLocaleString() }} → {{ new Date(event.endTime).toLocaleString() }}
      </p>

      <div v-if="event.eventAssets.length" class="mt-6">
        <h3 class="font-semibold mb-2">Images</h3>
        <img
          v-for="asset in event.eventAssets"
          :key="asset.imageUrl"
          :src="asset.imageUrl"
          class="rounded-lg mb-2"
        />
      </div>
    </div>
  </UContainer>
</template> -->
