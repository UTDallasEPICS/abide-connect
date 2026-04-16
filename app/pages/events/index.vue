<script setup lang="ts">
import { ref } from 'vue'
import type { DateValue } from '@internationalized/date'
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'

const tz = getLocalTimeZone()

const value = ref<DateValue>(new CalendarDate(2022, 2, 3))

const eventClick = () => {
  navigateTo('/events/event1')
}

type Event = {
  id: string
  title: string
  startTime: string
  location: {
    id: string
    address: string
    latitude: number
    longitude: number
  }
  eventAssets: any[]
}

const { data: eventsData, pending, error } = await useFetch<Event[]>('/api/events', {
  default: () => [],
})

const events = computed(() =>
  (eventsData.value || [])
  .filter(e => new Date(e.startTime).getTime() >= Date.now())
  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  .slice(0, 6)
  .map(e => ({
    id: e.id,
    title: e.title,
    date: new Date(e.startTime).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
  }),
  location: e.location?.address,
  image: e.eventAssets?.[0]?.url ?? '/images/image1.jpeg',
  }))
)

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
             <!-- Upcoming Events -->
          <div class="px-2 pb-4 pl-4 pt-4 w-full relative">
            <h3 class="text-2xl font-semibold text-brand4 mb-4">UPCOMING EVENTS</h3>
            <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <div 
                  v-for="event in events" 
                  :key="event.id" 
                  class="shrink-0 w-40 rounded-xl shadow-lg overflow-hidden hover:scale-95 transition-all duration-300 cursor-pointer">

                  <!-- Event Image Placeholder-->
                  <div class="h-35 relative overflow-hidden">
                    <img
                      :src="event.image"
                      class="w-full h-full object-cover"
                    >
                  </div>
                  
              <!-- Event Content -->
              <div class="p-2">
                <h4 class="text-sm font_semibold text-brand4 mb-1.5"> {{ event.title }}</h4>
              <div class="space-y-2">
                <!--Date-->
                <div class="flex items-center text-gray-600 text-[12px]">
                  <svg class="w-4 h-4 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>{{ event.date }}</span>
                </div>
                
                <!--Location-->
                <div class="flex items-start text-gray-600 text-[10px]">
                  <svg class="w-3 h-3 mr-2 ml-0.5 mt-0.5 text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span class="leading-tight"> {{ event.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

