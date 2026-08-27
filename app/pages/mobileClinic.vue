<template>
  <!-- Map Section -->
  <div
    id="mapbox"
    class="fixed inset-x-0 top-19 bottom-12 overflow-hidden"
  >
    <div
      id="map"
      class="h-full w-full relative overflow-hidden"
    >
      <MapInteractive
        :map-style="mapStyle"
        :center="center"
        :zoom="zoom"
      />
      <UDrawer
        :default-open="true"
        :handle-only="true"
        :dismissible="false"
        :overlay="false"
        :modal="false"
        :inset="true"
        :snap-points="snapPoints"
      >
        <template #content>
          <div
            class="overflow-y-auto space-y-2 px-2 pb-16"
          >
            <EventTile
              v-if="upcomingEvents.length === 0"
              class="w-11/12 mx-auto my-4 cursor-pointer"
              title="No upcoming events"
              subtitle="Check back later for updates!"
            />
            <EventTile
              v-for="event in upcomingEvents"
              v-else
              :key="event.id"
              class="w-11/12 mx-auto my-4 cursor-pointer"
              :title="event.title"
              :subtitle="
                new Date(event.startTime).toLocaleString()
              "
              button-type="arrow"
              :event-id="event.eventId"
              @add="eventClick"
              @click="handleTileClick(event)"
            />
          </div>
        </template>
      </UDrawer>
    </div>
  </div>
</template>

<script setup>
/**
 * Public mobile clinic locator: a map with a draggable sheet listing upcoming
 * stops and events. No account needed.
 *
 * Combines two sources — real events and the recurring clinic schedule, whose
 * occurrences are generated on the fly by `/api/mobile-clinic/schedule` and so
 * carry synthetic ids that aren't links. Tapping a tile recentres the map
 * rather than navigating, except for real events which do open.
 *
 * Data loads in `onMounted` because the map is client-only, so there's nothing
 * to render server-side anyway.
 */
import 'maplibre-gl/dist/maplibre-gl.css'

const mapStyle = '/mapstyles.json'
// Downtown Dallas — the default view before any stop is selected.
const center = ref([-96.77049780046936, 32.772891246510596])
const zoom = ref(15)

// Drawer heights in pixels: peek, half, full. vaul measures these up from the
// bottom of the *window*, so the sheet has to stay a viewport-anchored `fixed`
// element — teleporting it into the map box makes every snap point overshoot by
// however far that box sits above the viewport bottom.
const snapPoints = ['230', '340', '450']

const upcomingEvents = ref([])

// Load both events and mobile clinic schedule on mount
onMounted(async () => {
  console.log('✅ Page mounted - Loading events and mobile clinic schedule')
  await loadEvents()
  await loadMobileClinicSchedule()
})

const eventClick = (id) => {
  if (!id) return
  navigateTo(`/events/${id}`)
}

const handleTileClick = (event) => {
  if (!event?.location) return
  mapAdjust(event.location)
}

const setUpcomingItems = (items) => {
  upcomingEvents.value = items
    .map(item => ({
      ...item,
      subtitle:
                item.subtitle ?? new Date(item.startTime).toLocaleString(),
    }))
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime()
          - new Date(b.startTime).getTime(),
    )
}

async function loadMobileClinicSchedule() {
  try {
    const schedule = await $fetch('/api/mobile-clinic/schedule')
    console.log('✅ Loaded mobile clinic schedule:', schedule)

    const scheduleItems = schedule.map(item => ({
      ...item,
      title: `Mobile Clinic`,
      eventId: null,
    }))

    setUpcomingItems([...upcomingEvents.value, ...scheduleItems])
    console.log('📅 Combined schedule items:', scheduleItems.length)
  }
  catch (error) {
    console.error('❌ Error loading mobile clinic schedule:', error)
  }
}

async function loadEvents() {
  try {
    const allEvents = await $fetch('/api/events')
    console.log('✅ Loaded events from API:', allEvents)

    const now = new Date()

    const eventItems = allEvents
      .filter(event => event.mobileClinicId !== null)
      .filter(event => new Date(event.endTime) >= now)
      .map(event => ({
        ...event,
        eventId: event.id,
      }))

    setUpcomingItems([...upcomingEvents.value, ...eventItems])
    console.log('📅 Upcoming events:', eventItems.length)
  }
  catch (error) {
    console.error('❌ Error loading events:', error)
  }
}

async function mapAdjust(location) {
  const lng = location.longitude
  const lat = location.latitude

  console.log(`📍 Adjusting map to event location: [${lng}, ${lat}]`)
  center.value = [lng, lat]
  zoom.value = 17
}
</script>
