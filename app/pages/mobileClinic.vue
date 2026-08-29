<template>
  <!--
    Plain, unstyled wrapper: the single template root eslint asks for. It must
    stay free of transforms/filters, which would become the containing block
    for the `fixed` children below and break both the map box and the sheet.
  -->
  <div>
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
      </div>
    </div>

    <!--
      The sheet is a sibling of the map, not a child of it, and `portal` is off so
      it renders here rather than being teleported to `<body>`. Both matter: see
      the `snapPoints` note below for why it can't live inside the map box, and
      the z-index note for why it must not leave the app root.
    -->
    <UDrawer
      :default-open="true"
      :handle-only="true"
      :dismissible="false"
      :overlay="false"
      :modal="false"
      :inset="true"
      :portal="false"
      :snap-points="snapPoints"
      :ui="{ content: 'z-40 max-h-full' }"
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
            :subtitle="formatShortDateTime(event.startTime)"
            button-type="arrow"
            :event-id="event.eventId"
            @add="eventClick"
            @click="handleTileClick(event)"
          />
        </div>
      </template>
    </UDrawer>
  </div>
</template>

<script setup>
import { formatShortDateTime } from '#shared/utils/eventTime'
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
// element — anything that makes it `absolute` inside the map box (or gives one
// of its ancestors a transform) makes every snap point overshoot by however far
// that box sits above the viewport bottom.
//
// It therefore reaches the bottom of the screen and runs under the bottom nav,
// which is why it needs to sit *behind* it: hence `portal: false` plus an
// explicit `z-40` on the content. `@nuxt/ui` puts `isolate` on `#__nuxt`, so
// that root is its own stacking context and the nav's `z-60` only outranks
// things inside it — a sheet teleported to `<body>` is a sibling of the whole
// app and paints over the nav no matter what z-index either one carries. The
// `z-40` keeps it above maplibre's own controls (`z-index: 2`) and below both
// nav bars (top `z-50`, bottom `z-60`); the list's `pb-16` clears the 48px nav
// so no tile is stranded behind it.
//
// The stops are sized so each drag step reveals exactly one more row instead of
// a row and a fraction of the next. Measured against the sheet's own top edge:
// 22px of handle (`mt-4` + `h-1.5`), then rows on a 90px pitch (74px tall — a
// `h-12` thumbnail plus `py-3` and a border — with 16px between them), the
// first offset a further 16px by its own margin. A snap point of S leaves
// `S - 32` of that usable: +16 because the sheet sits `bottom-4` off the
// viewport floor, -48 for the bottom nav across its foot. Rounding up by 8
// lands the cut inside the gap between rows rather than on a row edge.
//
// This is also why the sheet is forced to `max-h-full` above: the drawer
// theme's own `max-h-[96%]` would make the usable height a function of the
// viewport, so the rows would drift out of alignment on any other screen size.
const ROW_PITCH = 90
const SHEET_CHROME = 22 + 16 + 8 + 16
const snapPoints = [1, 2, 3].map(rows => String(SHEET_CHROME + rows * ROW_PITCH))

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
      subtitle: item.subtitle ?? formatShortDateTime(item.startTime),
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
