<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'

const tz = getLocalTimeZone()

const value = ref<DateValue>(new CalendarDate(2022, 2, 3))

const fmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
})
const selectedText = computed(() =>
  value.value ? value.value.toDate(tz).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }) : '—'
)

const eventClick = () => {
  navigateTo('/events/event1')
}

const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))
</script>

<template>
  <div class="flex flex-col bg-white">
    <div class="w-full h-full mt-12 mb-12 px-4 py-6 overflow-y-auto">
      <UCard class="max-w-4xl mx-auto">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Events</h2>
          </div>
        </template>

        <div class="grid md:grid-cols-2 gap-6">
          <UCalendar
            v-model="value"
            color="brand7"
            :is-date-disabled="isDateDisabled"
            locale="en-US"
            weekday-format="short"
            :first-day-of-week="0"
            class="rounded-2xl"
          />
          <div class="space-y-4">
         <p class="text-xs uppercase tracking-wide text-gray-500">
          Upcoming Events
        </p>
        <USeperator class="mt-2" />
          </div>
        </div>

        
        <USeperator class="my-6" />

        <div class="space-y-4">
          <EventTile :onclick="eventClick"/>
          <EventTile />
          <EventTile />
          <EventTile />
        </div>
        

      </UCard>
    </div>
  </div>
</template>

