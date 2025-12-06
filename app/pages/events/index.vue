<script setup lang="ts">
import { ref } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'

const tz = getLocalTimeZone()

const value = ref<DateValue>(new CalendarDate(2022, 2, 3))

const eventClick = () => {
  navigateTo('/events/event1')
}

const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))
</script>

<template>
  <div class="flex flex-col bg-white">
    <div class="w-full h-full mt-12 mb-12 px-4 py-12 overflow-y-auto">
      <h2 class="text-2xl font-semibold text-brand4 mb-4">Events</h2>
        

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
          <EventTile :onclick="eventClick"/>
          <EventTile />
          <EventTile />
          <EventTile />
        </div>
    </div>
  </div>
</template>

