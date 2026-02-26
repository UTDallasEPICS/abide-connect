<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css';
import { ref, computed, onMounted } from "vue";

const route = useRoute()
const { data: event, error } = await useFetch(`/api/events/${route.params.id}`)

const isEditMode = ref(false)
const editForm = ref({ ...event.value })


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



const admin = true;

</script>


<template>
  <div v-if="!event">Loading...</div>
  <div v-else>
    <div class="flex flex-col mt-12 mb-12 w-full h-full bg-gray-100 items-center">

      <div class="flex gap-2 justify-left w-full max-w-4xl px-4 mt-6">
            <UButton
              v-if="!isEditMode && admin"
              icon="i-lucide-pencil"
              color="brand4"
              variant="soft"
              @click="isEditMode = true"
            >
              Edit Event
            </UButton>
            
            <template v-if="isEditMode">
              <UButton
                variant="ghost"
                color="brand4"
                @click="isEditMode = false"
              >
                Cancel
              </UButton>
              <UButton
                icon="i-lucide-check"
                color="brand4"
              >
                Save Changes
              </UButton>
            </template>
          </div>
          

      <UContainer class="flex-1 w-full h-full overflow-y-auto py-10">
         
        <h1  v-if="!isEditMode"  class="text-3xl font-hornbill font-bold mb-2 text-brand4 text-center">{{ event.title }}</h1>
        <UInput
            v-else
            v-model="editForm.title"
            size="xl"
            placeholder="Event Title"
            class="text-4xl font-bold"
            
          />
        <p v-if="!isEditMode" class="text-gray-600 text-xl font-poppins mb-4 text-center">{{ event.shortDesc }}</p>
        <UInput
            v-else
            v-model="editForm.shortDesc"
            size="xl"
            placeholder="Event Title"
            class="text-4xl font-bold"
            
          />
        <UCarousel v-if="!isEditMode" v-slot="{ item }" dots :items="items" class="h-80 max-w-xs mx-auto">
          <img :src="item" class="h-80 w-auto rounded-lg mx-auto">
        </UCarousel>
        <div v-else class="space-y-4">
            <div v-if="editForm.eventAssets && editForm.eventAssets.length > 0" class="grid grid-cols-2 gap-4">
              <div 
                v-for="(asset, index) in editForm.eventAssets"
                :key="index"
                class="relative h-48 rounded-xl overflow-hidden group"
              >
                <img 
                  :src="getImageUrl(asset)" 
                  alt="Event image"
                  class="w-full h-full object-cover"
                >
                <button
                  class="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
                  @click="removeImage(index)"
                >
                  <UIcon name="i-lucide-x" class="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Add Event Images
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                class="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-brand4
                  hover:file:bg-primary-100
                  cursor-pointer"
                  @change="handleImageUpload"
              >
            </div>
          </div>
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
          <MapInteractive :style="style" :center="center" :zoom="zoom" />
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
                  href="/volunteer"
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
