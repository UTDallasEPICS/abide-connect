<script setup lang="ts">
import 'maplibre-gl/dist/maplibre-gl.css'
import { ref, computed } from "vue"

const route = useRoute()
const eventId = route.params.id as string

// Single fetch — no onMounted duplicate
const { data: event, error, refresh } = await useFetch(`/api/events/${eventId}`)

if (error.value) {
  console.error('Failed to load event:', error.value)
}

const isEditMode = ref(false)
const editForm = ref<any>({})

// Placeholder until auth is implemented
const admin = true

// Assets shown in the edit uploader
const filesToUpload = ref<File[]>([])

function enterEditMode() {
  editForm.value = { 
    ...event.value,
    startTime: event.value?.startTime ? formatForInput(event.value.startTime) : '',
    endTime: event.value?.endTime ? formatForInput(event.value.endTime) : '',
  }
  isEditMode.value = true
}

function cancelEdit() {
  isEditMode.value = false
  filesToUpload.value = []
}

function formatForInput(isoString: string) {
  // Convert ISO date to datetime-local input format
  return new Date(isoString).toISOString().slice(0, 16)
}

function onFilesChanged(files: File[]) {
  filesToUpload.value = files
}

async function saveChanges() {
  try {
    await $fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: {
        title: editForm.value.title,
        shortDesc: editForm.value.shortDesc,
        description: editForm.value.description,
        location: editForm.value.location?.address || editForm.value.location,
        startTime: new Date(editForm.value.startTime).toISOString(),
        endTime: new Date(editForm.value.endTime).toISOString(),
        allowVolunteers: editForm.value.allowVolunteers,
        allowAttendees: editForm.value.allowAttendees,
      }
    })

    // Upload any new images
    for (const file of filesToUpload.value) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        await $fetch(`/api/events/${eventId}/images/upload`, {
          method: 'POST',
          body: formData
        })
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }

    filesToUpload.value = []
    isEditMode.value = false

    // Refresh event data
    await refresh()
  } catch (error) {
    console.error('Error updating event:', error)
    alert('Error updating event. Please try again.')
  }
}

const formattedDate = computed(() => {
  if (!event.value) return ''
  const start = new Date(event.value.startTime)
  const end = new Date(event.value.endTime)
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateStr} • ${startTime} - ${endTime}`
})

// Build carousel items from real assets, fall back to placeholders
const carouselItems = computed(() => {
  const assets = event.value?.eventAssets || []
  if (assets.length > 0) {
    return assets.map((a: any) => `/api/events/${eventId}/images/${a.imageUrl}`)
  }
  return [
    'https://picsum.photos/640/640?random=1',
    'https://picsum.photos/640/640?random=2',
    'https://picsum.photos/640/640?random=3',
  ]
})

const mapStyle = '/mapstyles.json'
const center = computed(() => {
  if (!event.value?.location) return [0, 0]
  return [event.value.location.longitude, event.value.location.latitude]
})
const zoom = 15

const backNavigate = computed(() => admin ? '/events/manage' : '/events')
</script>

<template>
  <div class="min-h-screen bg-gray-50 pb-24">

    <!-- Not Found -->
    <div v-if="error" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <UIcon name="i-lucide-calendar-x" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
        <p class="text-gray-600 mb-4">The event you're looking for doesn't exist.</p>
        <UButton icon="i-lucide-arrow-left" @click="navigateTo('/events/manage')">
          Back to Events
        </UButton>
      </div>
    </div>

    <!-- Event Details -->
    <div v-else-if="event">

      <!-- Sticky Header -->
      <div class="bg-white shadow-sm sticky top-0 z-10 mt-16">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <UButton icon="i-lucide-arrow-left" variant="ghost" class="text-brand4" @click="navigateTo(backNavigate)" />

          <div v-if="admin" class="flex gap-2">
            <UButton
              v-if="!isEditMode"
              icon="i-lucide-pencil"
              color="brand4"
              variant="soft"
              @click="enterEditMode"
            >
              Edit Event
            </UButton>
            <template v-else>
              <UButton variant="ghost" color="brand4" @click="cancelEdit">Cancel</UButton>
              <UButton icon="i-lucide-check" color="brand4" @click="saveChanges">Save Changes</UButton>
            </template>
          </div>
        </div>
      </div>

      <div class="max-w-4xl mx-auto px-4 py-8">

        <!-- Title -->
        <div class="mb-6">
          <h1 v-if="!isEditMode" class="text-3xl font-hornbill font-bold mb-2 text-brand4 text-center">
            {{ event.title }}
          </h1>
          <UInput v-else v-model="editForm.title" size="xl" placeholder="Event Title" />
        </div>

        <!-- Short Description -->
        <div v-if="event.shortDesc || isEditMode" class="bg-brand6 rounded-2xl p-3 mb-6">
          <p v-if="!isEditMode" class="text-md text-gray-700 italic">{{ event.shortDesc }}</p>
          <UInput v-else v-model="editForm.shortDesc" placeholder="Short Description" size="lg" />
        </div>

        <!-- Carousel (view mode) -->
        <div v-if="!isEditMode" class="mb-8">
          <UCarousel
            v-slot="{ item }"
            dots
            :items="carouselItems"
            class="h-80 max-w-xs mx-auto"
          >
            <img :src="item" class="h-80 w-auto rounded-lg mx-auto object-cover">
          </UCarousel>
        </div>

        <!-- Image management (edit mode) -->
        <div v-else class="mb-8">
          <label class="block text-sm font-medium text-gray-700 mb-2">Event Images</label>
          <EventImageUpload
            :existing-assets="event.eventAssets"
            :event-id="eventId"
            @files-changed="onFilesChanged"
          />
        </div>

        <!-- Date & Location -->
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div class="flex items-start gap-4 mb-4">
            <div class="bg-brand6 p-3 rounded-xl">
              <UIcon name="i-lucide-calendar" class="w-6 h-6 text-brand4" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-1">Date & Time</p>
              <p v-if="!isEditMode" class="text-gray-900 font-medium">{{ formattedDate }}</p>
              <div v-else class="grid grid-rows-2 gap-2">
                <div>
                  <label class="text-xs text-gray-500">Start</label>
                  <UInput v-model="editForm.startTime" type="datetime-local" />
                </div>
                <div>
                  <label class="text-xs text-gray-500">End</label>
                  <UInput v-model="editForm.endTime" type="datetime-local" />
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="bg-brand6 p-3 rounded-xl">
              <UIcon name="i-lucide-map-pin" class="w-6 h-6 text-brand4" />
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-500 mb-1">Location</p>
              <p v-if="!isEditMode" class="text-gray-900 font-medium">{{ event.location?.address }}</p>
              <UInput v-else v-model="editForm.location.address" placeholder="Event Location" />
            </div>
          </div>
        </div>

        <!-- Map (view mode only) -->
        <div v-if="!isEditMode && event.location" id="map" class="h-60 relative overflow-hidden mb-6">
          <MapInteractive :style="mapStyle" :center="center" :zoom="zoom" />
        </div>

        <!-- Description -->
        <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 class="text-2xl font-semibold mb-4">About This Event</h2>
          <p v-if="!isEditMode" class="text-gray-700 leading-relaxed whitespace-pre-line">
            {{ event.description }}
          </p>
          <UTextarea v-else v-model="editForm.description" placeholder="Full event description" :rows="6" />
        </div>

        <!-- Mobile Clinic notice -->
        <div v-if="event.mobileClinicId" class="mt-4 mb-4">
          <p class="text-gray-600 font-poppins">
            This event is part of our Mobile Clinic program.
          </p>
        </div>

        <!-- Event Settings (edit mode) -->
        <div v-if="admin && isEditMode" class="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 class="text-2xl font-semibold mb-4">Event Settings</h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-users" class="w-5 h-5 text-brand4" />
                <div>
                  <p class="font-medium text-gray-900">Volunteer Sign-ups</p>
                  <p class="text-sm text-gray-500">Allow people to volunteer for this event</p>
                </div>
              </div>
              <UCheckbox v-model="editForm.allowVolunteers" color="brand4" />
            </div>
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-ticket" class="w-5 h-5 text-brand4" />
                <div>
                  <p class="font-medium text-gray-900">Attendee Registration</p>
                  <p class="text-sm text-gray-500">Allow people to register as attendees</p>
                </div>
              </div>
              <UCheckbox v-model="editForm.allowAttendees" color="brand4" />
            </div>
          </div>
        </div>

        <!-- Action Buttons (view mode) -->
        <div v-if="!isEditMode" class="flex gap-4">
          <UButton
            v-if="event.allowVolunteers"
            color="brand4"
            size="xl"
            block
            icon="i-lucide-heart-handshake"
          >
            Sign Up as Volunteer
          </UButton>
          <UButton
            v-if="event.allowAttendees"
            color="brand4"
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