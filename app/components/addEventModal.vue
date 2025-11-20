<script setup>
import { ref } from "vue"

const emit = defineEmits(["save"])

const newEvent = ref({
  title: "",
  shortDesc: "",
  description: "",
  location: "",
  startTime: "",
  endTime: "",
  allowVolunteers: false,
  allowAttendees: false,
  mobileClinicId: null,
  images: []
})

const uploadedFiles = ref([])

function handleFileChange(files) {
  uploadedFiles.value = files
  // Convert files to base64 or URLs for preview/storage
  const imagePromises = files.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsDataURL(file)
    })
  })
  
  Promise.all(imagePromises).then(images => {
    newEvent.value.images = images
  })
}

async function saveEvent() {
  // Send to API
  try {
    const response = await $fetch('/api/events', {
      method: 'POST',
      body: {
        title: newEvent.value.title,
        shortDesc: newEvent.value.shortDesc,
        description: newEvent.value.description,
        location: newEvent.value.location,
        startTime: new Date(newEvent.value.startTime).toISOString(),
        endTime: new Date(newEvent.value.endTime).toISOString(),
        allowVolunteers: newEvent.value.allowVolunteers,
        allowAttendees: newEvent.value.allowAttendees,
        mobileClinicId: newEvent.value.mobileClinicId
      }
    })

    // Upload images if event was created successfully
    if (response.id && newEvent.value.images.length > 0) {
      for (const image of newEvent.value.images) {
        // Convert base64 to blob
        const blob = await fetch(image).then(r => r.blob())
        const formData = new FormData()
        formData.append('file', blob)
        
        await $fetch(`/api/events/${response.id}/uploadImage`, {
          method: 'POST',
          body: formData
        })
      }
    }

    emit("save", response)
    
    // Reset form
    newEvent.value = {
      title: "",
      shortDesc: "",
      description: "",
      location: "",
      startTime: "",
      endTime: "",
      allowVolunteers: false,
      allowAttendees: false,
      mobileClinicId: null,
      images: []
    }
    uploadedFiles.value = []
  } catch (error) {
    console.error('Error creating event:', error)
  }
}
</script>

<template>
  <div class="space-y-4 p-4">
    <h3 class="text-xl font-semibold mb-4">Add New Event</h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
      <UFormGroup>
        <UInput v-model="newEvent.title" placeholder="Enter event title" />
      </UFormGroup>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
      <UFormGroup>
        <UInput v-model="newEvent.shortDesc" placeholder="Brief description" />
      </UFormGroup>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
      <UFormGroup>
        <UTextarea v-model="newEvent.description" placeholder="Detailed description" :rows="4" />
      </UFormGroup>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
      <UFormGroup>
        <UInput v-model="newEvent.location" placeholder="Enter location address" />
      </UFormGroup>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
        <UFormGroup>
          <UInput type="datetime-local" v-model="newEvent.startTime" />
        </UFormGroup>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
        <UFormGroup>
          <UInput type="datetime-local" v-model="newEvent.endTime" />
        </UFormGroup>
      </div>
    </div>

    <div class="space-y-2">
      <label class="flex items-center gap-2">
        <UCheckbox v-model="newEvent.allowVolunteers" />
        <span class="text-sm font-medium text-gray-700">Allow Volunteers</span>
      </label>

      <label class="flex items-center gap-2">
        <UCheckbox v-model="newEvent.allowAttendees" />
        <span class="text-sm font-medium text-gray-700">Allow Attendees to Register</span>
      </label>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Event Images</label>
      <UFileUpload 
        multiple 
        accept="image/*"
        class="w-full min-h-48" 
        @change="handleFileChange"
        v-model="uploadedFiles"
      />
    </div>

    <!-- Preview images if uploaded -->
    <div v-if="newEvent.images.length > 0" class="mt-2">
      <p class="text-sm text-gray-600 mb-2">Image Previews:</p>
      <div class="grid grid-cols-2 gap-2">
        <img 
          v-for="(image, index) in newEvent.images"
          :key="index"
          :src="image" 
          alt="Event preview" 
          class="w-full h-32 object-cover rounded-lg"
        />
      </div>
    </div>

    <div class="flex justify-end pt-2">
      <UButton color="primary" @click="saveEvent">Create Event</UButton>
    </div>
  </div>
</template>