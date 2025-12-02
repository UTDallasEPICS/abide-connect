<script setup>
import { ref, onMounted } from "vue"
import AddEventModal from "~/components/addEventModal.vue"

const showAddModal = ref(false)

const pastEvents = ref([
  { 
    id: 1, 
    title: "Summer Festival 2024",
    location: "Central Park",
    startTime: "2024-07-15T10:00:00",
    endTime: "2024-07-15T18:00:00",
    eventAssets: [{ imageUrl: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400" }]
  },
  { 
    id: 2, 
    title: "Tech Conference",
    location: "Convention Center",
    startTime: "2024-09-20T09:00:00",
    endTime: "2024-09-20T17:00:00",
    eventAssets: [{ imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400" }]
  },
  { 
    id: 3, 
    title: "Art Exhibition",
    location: "Downtown Gallery",
    startTime: "2024-10-05T12:00:00",
    endTime: "2024-10-05T20:00:00",
    eventAssets: [{ imageUrl: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400" }]
  },
])

const upcomingEvents = ref([
  { 
    id: 4, 
    title: "Holiday Gala",
    location: "Grand Hotel",
    startTime: "2025-12-20T19:00:00",
    endTime: "2025-12-20T23:00:00",
    eventAssets: [{ imageUrl: "https://images.unsplash.com/photo-1519167758481-83f29da8c1b0?w=400" }]
  },
  { 
    id: 5, 
    title: "Spring Concert",
    location: "Music Hall",
    startTime: "2025-03-15T20:00:00",
    endTime: "2025-03-15T22:00:00",
    eventAssets: [{ imageUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400" }]
  },
  { 
    id: 6, 
    title: "Business Summit",
    location: "Downtown",
    startTime: "2025-02-10T08:00:00",
    endTime: "2025-02-10T17:00:00",
    eventAssets: [{ imageUrl: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=400" }]
  },
])

// Debug on mount
onMounted(() => {
  console.log('✅ Page mounted')
  console.log('✅ navigateToEvent function exists:', typeof navigateToEvent)
  console.log('✅ pastEvents:', pastEvents.value)
  console.log('✅ upcomingEvents:', upcomingEvents.value)
})

// Called when modal emits "save"
async function addEventToList(event) {
  upcomingEvents.value.push({
    id: event.id,
    title: event.title,
    shortDesc: event.shortDesc,
    description: event.description,
    location: event.location,
    startTime: event.startTime,
    endTime: event.endTime,
    allowVolunteers: event.allowVolunteers,
    allowAttendees: event.allowAttendees,
    eventAssets: event.eventAssets || []
  })
  
  showAddModal.value = false
  
  // Navigate to the new event's page
  navigateToEvent(event.id)
}

// Navigate to event template page
async function navigateToEvent(eventId) {
  console.log('🚀 Clicked event with ID:', eventId)
  console.log('🚀 Navigating to:', `/event-detail/${eventId}`)
  
  // Nuxt 4 navigation
  await navigateTo(`/event-detail/${eventId}`)
}

// Test function
function testNavigation() {
  console.log('🧪 TEST BUTTON CLICKED!')
  navigateToEvent(1)
}

// Helper function to get first image from event
function getEventImage(event) {
  if (event.eventAssets && event.eventAssets.length > 0) {
    return event.eventAssets[0].imageUrl
  }
  return null
}
</script>

<template>
  <div class="flex flex-col">
    
    <div class="flex-1 mt-12 mb-8 w-full overflow-y-auto">

      <!-- HEADER -->
      <div class="flex items-center justify-between px-5 py-4">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          class="rounded-full border border-black p-2"
        />
      </div>

      <h1 class="text-center text-2xl font-bold tracking-wide pb-3">
        EVENTS MANAGEMENT
      </h1>

      <!-- TEST BUTTON - Remove this after testing -->
      <div class="px-5 mb-4">
        <button 
          @click="testNavigation"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          🧪 TEST: Navigate to Event 1
        </button>
      </div>

      <!-- PAST EVENTS -->
      <div class="px-5">
        <h2 class="text-xl font-semibold mb-3">PAST EVENTS</h2>

        <div class="flex gap-3 overflow-x-auto pb-2">
          <button
            v-for="event in pastEvents"
            :key="event.id"
            @click.stop="navigateToEvent(event.id)"
            class="min-w-[120px] h-[120px] border border-gray-400 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow"
            type="button"
          >
            <div 
              class="flex justify-center items-center flex-1 text-4xl text-gray-700 rounded-t-2xl overflow-hidden pointer-events-none"
              :style="getEventImage(event) ? `background-image: url(${getEventImage(event)}); background-size: cover; background-position: center;` : ''"
            >
              <span v-if="!getEventImage(event)">+</span>
            </div>
            <div class="h-[40px] bg-gray-200 rounded-b-2xl flex items-center justify-center px-2 pointer-events-none">
              <p class="text-xs font-medium text-gray-700 truncate">{{ event.title }}</p>
            </div>
          </button>
        </div>
      </div>

      <!-- UPCOMING EVENTS -->
      <div class="px-5 mt-6">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">UPCOMING EVENTS</h2>

          <UModal>
            <template #default="{ open }">
              <UButton
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="lg"
                class="rounded-full"
                label="Add"
                @click="open"
              />
            </template>

            <template #body>
              <AddEventModal @save="addEventToList" />
            </template>
          </UModal>
        </div>

        <div class="mt-4 flex flex-col gap-4">
          <button
            v-for="event in upcomingEvents"
            :key="event.id"
            @click.stop="navigateToEvent(event.id)"
            class="flex items-center gap-4 border border-gray-300 rounded-2xl p-4 bg-white cursor-pointer hover:shadow-lg transition-shadow"
            type="button"
          >
            <div 
              class="w-14 h-14 rounded-xl bg-[#9c1a33] flex-shrink-0 overflow-hidden pointer-events-none"
              :style="getEventImage(event) ? `background-image: url(${getEventImage(event)}); background-size: cover; background-position: center;` : ''"
            ></div>

            <div class="flex flex-col text-left pointer-events-none">
              <p class="text-gray-800 font-semibold">{{ event.title }}</p>
              <p class="text-gray-500 text-sm">{{ event.location }}</p>
              <p class="text-gray-400 text-xs">{{ new Date(event.startTime).toLocaleDateString() }}</p>
            </div>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>