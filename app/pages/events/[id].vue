<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css';
const route = useRoute()
const { data: event, error } = await useFetch(`/api/events/${route.params.id}`)

if (error.value) {
  console.error(error.value)
  showError({
    statusCode: error.value.statusCode,
    statusMessage: "The requested event could not be fetched."
  })
}

const toast = useToast()

const showToast = (success: boolean) => {
  if(success) {
    toast.add({
      title: "Successfully uploaded image.",
      icon: "i-lucide-image-up",
      color: "success"
    })
  } else {
    toast.add({
      title: "Error uploading image.",
      icon: "i-lucide-circle-x",
      color: "error"
    })
  }
}

const placeholders = [
  'https://picsum.photos/640/640?random=1',
  'https://picsum.photos/640/640?random=2',
  'https://picsum.photos/640/640?random=3',
  'https://picsum.photos/640/640?random=4',
  'https://picsum.photos/640/640?random=5',
  'https://picsum.photos/640/640?random=6'
]

const fetchedItems = event.value?.eventAssets.map((asset) => "/api/events/" + asset.imageUrl)

const items = (fetchedItems?.length || 0) > 0 ? fetchedItems : placeholders

const style = '/mapstyles.json'
const center = [-96.77049780046936, 32.772891246510596]
const zoom = 15

const fileUpload = async (file: File | null | undefined) => {
  if(!file) {
    return
  }

  const formData = new FormData()
  formData.append("file", file)

  const res = await $fetch.raw(`/api/events/${route.params.id}/images/upload`, {
    method: 'POST',
    body: formData,
    ignoreResponseError: true
  })

  showToast(res.status === 201)
}

</script>


<template>
  <div v-if="!event">Loading...</div>
  <div v-else>
    <div class="flex flex-col mt-12 mb-12 w-full h-full bg-gray-100 items-center">
      <UContainer class="flex-1 w-full h-full overflow-y-auto py-10">

        <h1 class="text-3xl font-hornbill font-bold mb-2 text-brand4 text-center">{{ event.title }}</h1>
        <p class="text-gray-600 text-xl font-poppins mb-4 text-center">{{ event.shortDesc }}</p>
        <UCarousel v-slot="{ item }" dots :items="items" class="h-80 max-w-xs mx-auto">
          <img :src="item" class="h-80 w-auto rounded-lg mx-auto">
        </UCarousel>
        <div class="flex-1 mt-4 mb-10 w-full h-full overflow-y-auto"/>

        <p class="text-gray-600 font-poppins mb-4">{{ event.description }}</p>

        <div v-if="event.mobileClinicId" class="mt-4 mb-4">
          <p class="text-gray-600 font-poppins">
            This event is part of our Mobile Clinic program. Please visit the clinic for health services and support.
          </p>  
        </div>

        <p class="text-gray-600 font-poppins mb-4">
          📍 {{ event.location }}  
          <br >
          🕒 {{ new Date(event.startTime).toLocaleString() }} → {{ new Date(event.endTime).toLocaleString() }}
        </p>
        
        <div id="map" class="h-60 relative overflow-hidden justify-center items-center">
          <AbideMap :style="style" :center="center" :zoom="zoom" />
        </div>

        <div class="flex-1 mt-4 mb-2 w-full h-full overflow-y-auto"/>

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
          <div class="h-12" />
          <UFileUpload 
            accept="image/*" 
            label="Upload an Image for this event!"
            description="Image files only"
            @update:model-value="fileUpload"/>
        </UContainer>

        <div class="flex-1 mt-4 mb-8 w-full h-full overflow-y-auto"/>
      
      </UContainer>            
          
    </div>
  </div>
</template>    
