<script setup>
import { ref, computed, onMounted } from "vue"

const route = useRoute()

// Get the ID from the route params
const eventId = route.params.id

// In a real app, fetch this from API based on eventId
const event = ref({
  id: eventId,
  title: "Summer Festival 2024",
  shortDesc: "A celebration of music, art, and community",
  description: "Join us for an unforgettable day filled with live performances, art installations, food vendors, and family-friendly activities. This annual festival brings together the best of our community in a beautiful outdoor setting.",
  location: "Central Park, Main Pavilion Area",
  startTime: "2024-07-15T10:00:00",
  endTime: "2024-07-15T18:00:00",
  allowVolunteers: true,
  allowAttendees: true,
  eventAssets: [
    { imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800" },
    { imageUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800" }
  ],
  volunteers: [],
  attendees: []
})

const isEditMode = ref(false)
const editForm = ref({ ...event.value })

// Fetch event data on mount
onMounted(async () => {
  try {
    // Uncomment when you have the API ready
    // const response = await $fetch(`/api/events/${eventId}`)
    // event.value = response
    // editForm.value = { ...response }
    
    console.log('Loading event with ID:', eventId)
  } catch (error) {
    console.error('Error fetching event:', error)
  }
})

const formattedDate = computed(() => {
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
    // Cancel editing
    editForm.value = { ...event.value }
  }
  isEditMode.value = !isEditMode.value
}

async function saveChanges() {
  try {
    // Save to API
    const response = await $fetch(`/api/events/${event.value.id}`, {
      method: 'PATCH',
      body: editForm.value
    })
    
    event.value = { ...editForm.value }
    isEditMode.value = false
  } catch (error) {
    console.error('Error updating event:', error)
  }
}

const uploadedFiles = ref([])

function handleImageUpload(files) {
  uploadedFiles.value = files
  // Handle new image uploads
  const imagePromises = files.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve({ imageUrl: e.target.result })
      reader.readAsDataURL(file)
    })
  })
  
  Promise.all(imagePromises).then(images => {
    editForm.value.eventAssets = [...editForm.value.eventAssets, ...images]
  })
}

function removeImage(index) {
  editForm.value.eventAssets.splice(index, 1)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 pb-24">
    <!-- Header with Edit Button -->
    <div class="bg-white shadow-sm sticky top-0 z-10 mt-16">
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          @click="navigateTo('/eventManagement')"
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
              @click="saveChanges"
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
            v-if="event.eventAssets.length > 0"
            :src="event.eventAssets[0].imageUrl" 
            alt="Event banner"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
            <span class="text-6xl">📷</span>
          </div>
        </div>
        
        <!-- Edit Mode Images -->
        <div v-else class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div 
              v-for="(asset, index) in editForm.eventAssets"
              :key="index"
              class="relative h-48 rounded-xl overflow-hidden group"
            >
              <img 
                :src="asset.imageUrl" 
                alt="Event image"
                class="w-full h-full object-cover"
              />
              <button
                @click="removeImage(index)"
                class="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <UIcon name="i-lucide-x" class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <UFileUpload 
            multiple 
            accept="image/*"
            v-model="uploadedFiles"
            class="w-full min-h-32" 
            @change="handleImageUpload"
          />
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
              <UInput type="datetime-local" v-model="editForm.startTime" />
              <UInput type="datetime-local" v-model="editForm.endTime" />
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
      <div class="bg-primary-50 rounded-2xl p-6 mb-6">
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
            <label v-if="isEditMode" class="flex items-center gap-2">
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
            <label v-if="isEditMode" class="flex items-center gap-2">
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
</template>