<script setup>
import { ref, computed, onMounted } from "vue"

const route = useRoute()

// Get the ID from the route params
const eventId = route.params.id

const event = ref(null)
const loading = ref(true)
const notFound = ref(false)

const isEditMode = ref(false)
const editForm = ref({})

// Fetch event data from API on mount
onMounted(async () => {
  try {
    console.log('📡 Loading event with ID:', eventId)
    
    // Fetch event from your backend API
    const response = await $fetch(`/api/events/${eventId}`)
    
    event.value = response
    editForm.value = { ...response }
    
    console.log('✅ Event loaded:', event.value)
    loading.value = false
    
  } catch (error) {
    console.error('❌ Error fetching event:', error)
    loading.value = false
    notFound.value = true
  }
})

const formattedDate = computed(() => {
  if (!event.value) return ''
  
  const start = new Date(event.value.startTime)
  const end = new Date(event.value.endTime)
  
  const dateStr = start.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const startTime = start.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  })
  
  const endTime = end.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  })
  
  return `${dateStr} • ${startTime} - ${endTime}`
})

function toggleEditMode() {
  if (isEditMode.value) {
    // Cancel editing - reset form to original event data
    editForm.value = { ...event.value }
  }
  isEditMode.value = !isEditMode.value
}

async function saveChanges() {
  try {
    console.log('💾 Saving changes...')
    
    // Update event via API
    const response = await $fetch(`/api/events/${event.value.id}`, {
      method: 'PATCH',
      body: {
        title: editForm.value.title,
        shortDesc: editForm.value.shortDesc,
        description: editForm.value.description,
        location: editForm.value.location,
        startTime: new Date(editForm.value.startTime).toISOString(),
        endTime: new Date(editForm.value.endTime).toISOString(),
        allowVolunteers: editForm.value.allowVolunteers,
        allowAttendees: editForm.value.allowAttendees
      }
    })
    
    // Update local event data
    event.value = { ...editForm.value }
    isEditMode.value = false
    
    console.log('✅ Event updated successfully')
  } catch (error) {
    console.error('❌ Error updating event:', error)
    alert('Error updating event. Please try again.')
  }
}

const uploadedFiles = ref([])
const filesToUpload = ref([])

function handleImageUpload(event) {
  const files = event.target?.files || event
  
  if (!files || files.length === 0) return
  
  // Store actual File objects for upload
  filesToUpload.value = [...filesToUpload.value, ...Array.from(files)]
  
  // Create preview URLs
  const imagePromises = Array.from(files).map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve({ 
        imageUrl: e.target.result,
        fileName: file.name,
        isPreview: true 
      })
      reader.readAsDataURL(file)
    })
  })
  
  Promise.all(imagePromises).then(images => {
    editForm.value.eventAssets = [...(editForm.value.eventAssets || []), ...images]
  })
}

async function uploadNewImages() {
  if (filesToUpload.value.length === 0) return
  
  console.log(`📤 Uploading ${filesToUpload.value.length} new images...`)
  
  for (const file of filesToUpload.value) {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      await $fetch(`/api/events/${event.value.id}/uploadImage`, {
        method: 'POST',
        body: formData
      })
      console.log(`✅ Uploaded: ${file.name}`)
    } catch (uploadError) {
      console.error(`❌ Failed to upload ${file.name}:`, uploadError)
    }
  }
  
  // Clear the upload queue
  filesToUpload.value = []
  
  // Reload event to get updated image URLs
  const updatedEvent = await $fetch(`/api/events/${event.value.id}`)
  event.value = updatedEvent
  editForm.value = { ...updatedEvent }
}

function removeImage(index) {
  const asset = editForm.value.eventAssets[index]
  
  // If it's a preview (not yet uploaded), just remove from array
  if (asset.isPreview) {
    editForm.value.eventAssets.splice(index, 1)
    filesToUpload.value.splice(index, 1)
  } else {
    // If it's an existing image, we'd need a delete endpoint
    // For now, just remove from display
    editForm.value.eventAssets.splice(index, 1)
  }
}

// Helper to get proper image URL
function getImageUrl(asset) {
  if (asset.isPreview) {
    return asset.imageUrl // Base64 preview
  }
  // Use your backend image endpoint
  return `/api/events/${event.value.id}/images/${asset.imageUrl.split('/').pop()}`
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 pb-24">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading event...</p>
      </div>
    </div>

    <!-- Not Found State -->
    <div v-else-if="notFound" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <UIcon name="i-lucide-calendar-x" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
        <p class="text-gray-600 mb-4">The event you're looking for doesn't exist.</p>
        <UButton
          icon="i-lucide-arrow-left"
          @click="navigateTo('/eventManagement')"
        >
          Back to Events
        </UButton>
      </div>
    </div>

    <!-- Event Details -->
    <div v-else>
      <!-- Header with Edit Button -->
      <div class="bg-white shadow-sm sticky top-0 z-10 mt-16">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <UButton
            icon="i-lucide-arrow-left"
            variant="ghost"
            @click="navigateTo('/events/manage')"
          />
          
          <div class="flex gap-2">
            <UButton
              v-if="!isEditMode"
              icon="i-lucide-pencil"
              color="primary"
              variant="soft"
              @click="toggleEditMode"
            >
              Edit Event
            </UButton>
            
            <template v-else>
              <UButton
                variant="ghost"
                @click="toggleEditMode"
              >
                Cancel
              </UButton>
              <UButton
                icon="i-lucide-check"
                color="primary"
                @click="async () => { await saveChanges(); await uploadNewImages(); }"
              >
                Save Changes
              </UButton>
            </template>
          </div>
        </div>
      </div>

      <div class="max-w-4xl mx-auto px-4 py-8">
        
        <!-- Event Images Carousel -->
        <div class="mb-8">
          <div v-if="!isEditMode" class="relative h-96 rounded-2xl overflow-hidden bg-gray-200">
            <img 
              v-if="event.eventAssets && event.eventAssets.length > 0"
              :src="getImageUrl(event.eventAssets[0])" 
              alt="Event banner"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <span class="text-6xl">📷</span>
            </div>
          </div>
          
          <!-- Edit Mode Images -->
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
                />
                <button
                  @click="removeImage(index)"
                  class="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  type="button"
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
                @change="handleImageUpload"
                class="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100
                  cursor-pointer"
              />
            </div>
          </div>
        </div>

        <!-- Event Title -->
        <div class="mb-6">
          <h1 v-if="!isEditMode" class="text-4xl font-bold text-gray-900 mb-2">
            {{ event.title }}
          </h1>
          <UInput
            v-else
            v-model="editForm.title"
            size="xl"
            placeholder="Event Title"
            class="text-4xl font-bold"
          />
        </div>

        <!-- Date & Location Card -->
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div class="flex items-start gap-4 mb-4">
            <div class="bg-primary-100 p-3 rounded-xl">
              <UIcon name="i-lucide-calendar" class="w-6 h-6 text-primary-600" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-1">Date & Time</p>
              <p v-if="!isEditMode" class="text-gray-900 font-medium">
                {{ formattedDate }}
              </p>
              <div v-else class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs text-gray-500">Start</label>
                  <UInput type="datetime-local" v-model="editForm.startTime" />
                </div>
                <div>
                  <label class="text-xs text-gray-500">End</label>
                  <UInput type="datetime-local" v-model="editForm.endTime" />
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="bg-primary-100 p-3 rounded-xl">
              <UIcon name="i-lucide-map-pin" class="w-6 h-6 text-primary-600" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-1">Location</p>
              <p v-if="!isEditMode" class="text-gray-900 font-medium">
                {{ event.location }}
              </p>
              <UInput
                v-else
                v-model="editForm.location"
                placeholder="Event Location"
              />
            </div>
          </div>
        </div>

        <!-- Short Description -->
        <div class="bg-primary-50 rounded-2xl p-6 mb-6" v-if="event.shortDesc || isEditMode">
          <p v-if="!isEditMode" class="text-lg text-gray-700 italic">
            "{{ event.shortDesc }}"
          </p>
          <UInput
            v-else
            v-model="editForm.shortDesc"
            placeholder="Short Description"
            size="lg"
          />
        </div>

        <!-- Full Description -->
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 class="text-2xl font-semibold mb-4">About This Event</h2>
          <p v-if="!isEditMode" class="text-gray-700 leading-relaxed whitespace-pre-line">
            {{ event.description }}
          </p>
          <UTextarea
            v-else
            v-model="editForm.description"
            placeholder="Full event description"
            :rows="6"
          />
        </div>

        <!-- Event Options -->
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 class="text-2xl font-semibold mb-4">Event Settings</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-users" class="w-5 h-5 text-primary-600" />
                <div>
                  <p class="font-medium text-gray-900">Volunteer Sign-ups</p>
                  <p class="text-sm text-gray-500">Allow people to volunteer for this event</p>
                </div>
              </div>
              <label v-if="isEditMode" class="flex items-center gap-2 cursor-pointer">
                <UCheckbox v-model="editForm.allowVolunteers" />
              </label>
              <label v-else class="flex items-center gap-2">
                <UCheckbox :model-value="event.allowVolunteers" disabled />
              </label>
            </div>

            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-ticket" class="w-5 h-5 text-primary-600" />
                <div>
                  <p class="font-medium text-gray-900">Attendee Registration</p>
                  <p class="text-sm text-gray-500">Allow people to register as attendees</p>
                </div>
              </div>
              <label v-if="isEditMode" class="flex items-center gap-2 cursor-pointer">
                <UCheckbox v-model="editForm.allowAttendees" />
              </label>
              <label v-else class="flex items-center gap-2">
                <UCheckbox :model-value="event.allowAttendees" disabled />
              </label>
            </div>
          </div>
        </div>

        <!-- Action Buttons for Attendees/Volunteers -->
        <div v-if="!isEditMode" class="flex gap-4">
          <UButton
            v-if="event.allowVolunteers"
            color="primary"
            size="xl"
            block
            icon="i-lucide-heart-handshake"
          >
            Sign Up as Volunteer
          </UButton>
          
          <UButton
            v-if="event.allowAttendees"
            color="primary"
            variant="outline"
            size="xl"
            block
            icon="i-lucide-ticket"
          >
            Register to Attend
          </UButton>
        </div>

      </div>
    </div>
  </div>
</template>