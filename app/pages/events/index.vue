<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'

const tz = getLocalTimeZone()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectedDate = ref<any>(today(tz))

// Load all events from API
const { data: allEvents } = await useFetch('/api/events')

const upcomingEvents = computed(() => {
  const now = new Date()
  return (allEvents.value || []).filter(event => new Date(event.endTime) >= now)
})

// Dates that have events — used to highlight calendar
const eventDates = computed(() => {
  return (allEvents.value || []).map(event => {
    const d = new Date(event.startTime)
    return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
  })
})

// Events on the selected calendar date
const eventsOnSelectedDate = computed(() => {
  if (!selectedDate.value) return upcomingEvents.value
  return (allEvents.value || []).filter(event => {
    const d = new Date(event.startTime)
    const cal = new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
    return cal.compare(selectedDate.value) === 0
  })
})

// Show date-filtered events if a date with events is selected, otherwise show all upcoming
const displayedEvents = computed(() => {
  if (eventsOnSelectedDate.value.length > 0) return eventsOnSelectedDate.value
  return upcomingEvents.value
})

const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))

function getEventImage(event: any) {
  if (event.eventAssets && event.eventAssets.length > 0) {
    const imageUrl = event.eventAssets[0].imageUrl
    const encoded = encodeURIComponent(imageUrl)
    return `/api/events/${event.id}/images/${encoded}`
  }
  return undefined
}


function getEventSubtitle(event: any) {
  const date = new Date(event.startTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const location = event.location?.address || ''
  return [date, location].filter(Boolean).join(' · ')
}

function goToEvent(id: string) {
  navigateTo(`/events/${id}`)
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
    <div class="w-full h-full mt-12 mb-12 px-4 py-12 overflow-y-auto">
      <h2 class="text-center text-2xl font-bold text-brand4 dark:text-teal-400 mb-6">
        Events
      </h2>

      <UCard class="max-w-4xl mx-auto mb-6">
        <UCalendar
          v-model="selectedDate"
          color="brand7"
          :is-date-disabled="isDateDisabled"
          locale="en-US"
          weekday-format="short"
          :first-day-of-week="0"
          class="rounded-2xl"
        />
      </UCard>

      <h3 class="text-lg font-semibold text-brand4 mb-4">
        {{ eventsOnSelectedDate.length > 0 ? 'Events on this day' : 'Upcoming Events' }}
      </h3>

      <div v-if="displayedEvents.length === 0" class="text-center text-gray-500 py-8">
        No upcoming events
      </div>

      <div v-else class="space-y-4">
        <EventTile
          v-for="event in displayedEvents"
          :key="event.id"
          :title="event.title"
          :subtitle="getEventSubtitle(event)"
          :image-url="getEventImage(event)"
          @click="goToEvent(event.id)"
          @add="goToEvent(event.id)"
        />
      </div>
    </div>
  </div>
</template>