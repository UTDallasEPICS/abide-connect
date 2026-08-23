<script setup>
/**
 * Staff event management: create events and edit existing ones, split into
 * upcoming and past.
 *
 * Admin-gated by `app/middleware/auth.global.ts` via the `/events/manage`
 * prefix; the write endpoints enforce it again server-side.
 *
 * Events load in `onMounted` rather than via `useFetch`, so this page renders
 * empty on the server and fills in on the client. Every mutation calls
 * `loadEvents()` again instead of patching the local arrays, which keeps the
 * two lists correctly partitioned when an edit moves an event across the
 * past/upcoming boundary.
 */
import { ref, onMounted } from 'vue'

const showAddModal = ref(false)

const pastEvents = ref([])
const upcomingEvents = ref([])

onMounted(async () => {
  console.log('✅ Page mounted - Loading events from API')
  await loadEvents()
})

async function loadEvents() {
  try {
    const allEvents = await $fetch('/api/events')
    console.log('✅ Loaded events from API:', allEvents)

    const now = new Date()

    pastEvents.value = allEvents.filter((event) => {
      const endTime = new Date(event.endTime)
      return endTime < now
    })

    upcomingEvents.value = allEvents.filter((event) => {
      const endTime = new Date(event.endTime)
      return endTime >= now
    })

    console.log('📅 Past events:', pastEvents.value.length)
    console.log('📅 Upcoming events:', upcomingEvents.value.length)
  }
  catch (error) {
    console.error('❌ Error loading events:', error)
  }
}

async function addEventToList(event) {
  console.log('✅ New event received from modal:', event)
  await loadEvents()
  showAddModal.value = false
}

function closeModal() {
  showAddModal.value = false
}

async function navigateToEvent(eventId) {
  console.log('🚀 Navigating to event:', eventId)
  await navigateTo(`/events/${eventId}`)
}

function getEventImage(event) {
  if (event.eventAssets && event.eventAssets.length > 0) {
    const imageUrl = event.eventAssets[0].imageUrl
    return `/api/events/${imageUrl}`
  }
  return null
}

function getEventDate(event) {
  return new Date(event.startTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="flex flex-col relative">
    <div class="flex-1 mt-12 mb-8 w-full overflow-y-auto">
      <h1 class="text-center text-2xl font-bold tracking-wide pb-3 text-gray-900 dark:text-gray-100">
        EVENTS MANAGEMENT
      </h1>

      <!-- PAST EVENTS -->
      <div class="px-5">
        <h2 class="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">
          PAST EVENTS
        </h2>

        <div
          v-if="pastEvents.length === 0"
          class="text-gray-500 dark:text-gray-400 text-center py-4"
        >
          No past events
        </div>

        <div
          v-else
          class="flex gap-3 overflow-x-auto pb-2"
        >
          <button
            v-for="event in pastEvents"
            :key="event.id"
            class="min-w-[120px] h-[120px] border border-gray-400 dark:border-gray-600 rounded-2xl flex flex-col justify-between cursor-pointer hover:shadow-lg transition-shadow bg-white dark:bg-gray-800"
            type="button"
            @click.stop="navigateToEvent(event.id)"
          >
            <div
              class="flex justify-center items-center flex-1 text-4xl text-gray-700 dark:text-gray-300 rounded-t-2xl overflow-hidden pointer-events-none"
              :style="
                getEventImage(event)
                  ? `background-image: url(${getEventImage(event)}); background-size: cover; background-position: center;`
                  : ''
              "
            >
              <span v-if="!getEventImage(event)">📅</span>
            </div>
            <div class="h-[40px] bg-gray-200 dark:bg-gray-700 rounded-b-2xl flex items-center justify-center px-2 pointer-events-none">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                {{ event.title }}
              </p>
            </div>
          </button>
        </div>
      </div>

      <!-- UPCOMING EVENTS -->
      <div class="px-5 mt-6">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold text-gray-800 dark:text-gray-200">
            UPCOMING EVENTS
          </h2>

          <UButton
            icon="i-lucide-plus"
            color="primary"
            variant="soft"
            size="lg"
            class="rounded-full"
            label="Add"
            @click="showAddModal = true"
          />
        </div>

        <div
          v-if="upcomingEvents.length === 0"
          class="text-gray-500 dark:text-gray-400 text-center py-8"
        >
          No upcoming events. Click "Add" to create one!
        </div>

        <div
          v-else
          class="mt-4 flex flex-col gap-4"
        >
          <button
            v-for="event in upcomingEvents"
            :key="event.id"
            class="flex items-center gap-4 border border-gray-300 dark:border-gray-700 rounded-2xl p-4 bg-white dark:bg-gray-800 cursor-pointer hover:shadow-lg dark:hover:shadow-gray-950/50 transition-shadow"
            type="button"
            @click.stop="navigateToEvent(event.id)"
          >
            <div
              class="w-14 h-14 rounded-xl bg-[#9c1a33] flex-shrink-0 overflow-hidden pointer-events-none"
              :style="
                getEventImage(event)
                  ? `background-image: url(${getEventImage(event)}); background-size: cover; background-position: center;`
                  : ''
              "
            >
              <span
                v-if="!getEventImage(event)"
                class="flex items-center justify-center h-full text-white text-2xl"
              >📅</span>
            </div>
            <div class="flex flex-col text-left pointer-events-none">
              <p class="text-gray-800 dark:text-gray-100 font-semibold">
                {{ event.title }}
              </p>
              <p class="text-gray-500 dark:text-gray-400 text-sm">
                {{ event.location.address }}
              </p>
              <p class="text-gray-400 dark:text-gray-500 text-xs">
                {{ getEventDate(event) }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Manual Modal with Teleport -->
    <Teleport to="body">
      <div
        v-if="showAddModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4"
        @click.self="closeModal"
      >
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl dark:shadow-gray-950/50 max-w-2xl w-full max-h-[90vh] overflow-auto">
          <EventModal
            @save="addEventToList"
            @close="closeModal"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
