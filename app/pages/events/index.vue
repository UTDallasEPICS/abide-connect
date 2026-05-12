<script setup lang="ts">
import { ref } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'

const tz = getLocalTimeZone()

const value = ref<DateValue>(new CalendarDate(2022, 2, 3))

const eventClick = (id?: string) => {
  if (!id) return
  navigateTo(`/events/${id}`)
}

const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
    <div class="w-full h-full mt-12 mb-12 px-4 py-12 overflow-y-auto">
      <h2 class="text-center text-2xl font-bold text-brand4 dark:text-teal-400">Events</h2>
        

        <UCard class="max-w-4xl mx-auto mb-4">
          <UCalendar
            :v-model="value"
            color="brand7"
            :is-date-disabled="isDateDisabled"
            locale="en-US"
            weekday-format="short"
            :first-day-of-week="0"
            class="rounded-2xl"
          />

          </UCard>
        <h3 class="text-lg font-semibold text-brand4 mb-4">
          Upcoming Events
        </h3>
        

        <div class="space-y-4">
          <EventTile
            title="Community Health Fair"
            subtitle="Tap to view details"
            button-type="arrow"
            event-id="event1"
            @add="eventClick"
          />
          <EventTile
            title="Support Workshop"
            subtitle="Tap to view details"
            button-type="arrow"
            event-id="event2"
            @add="eventClick"
          />
          <EventTile
            title="Family Clinic"
            subtitle="Tap to view details"
            button-type="arrow"
            event-id="event3"
            @add="eventClick"
          />
          <EventTile
            title="Wellness Check"
            subtitle="Tap to view details"
            button-type="arrow"
            event-id="event4"
            @add="eventClick"
          />
        </div>
    </div>
  </div>
</template>

