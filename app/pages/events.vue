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

const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))

const goToday = () => { value.value = today(tz) }
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">

    <!-- Header -->
    <header class="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <UIcon name="i-heroicons-cog-6-tooth" class="w-6 h-6 text-gray-700 dark:text-gray-200" />
        <h1 class="text-base sm:text-lg font-semibold tracking-wide">EVENTS</h1>
        <UIcon name="i-heroicons-inbox" class="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </div>
    </header>

    
    <main class="flex-1 px-4 py-6">
      <UCard class="max-w-4xl mx-auto">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Events</h2>
            <div class="flex items-center gap-2">
              <UButton size="sm" variant="soft" @click="goToday">Today</UButton>
              <UButton size="sm" color="primary" icon="i-heroicons-plus">New event</UButton>
            </div>
          </div>
        </template>

        <div class="grid md:grid-cols-2 gap-6">
          <UCalendar
            v-model="value"
            color="emerald"
            :is-date-disabled="isDateDisabled"
            locale="en-US"
            weekday-format="short"
            :first-day-of-week="0"
            class="rounded-2xl"
          />
          <div class="space-y-4">
            <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Selected date
            </p>
            <p class="text-2xl font-medium">{{ selectedText }}</p>
            <UDivider />
            <ul class="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-300 text-sm">
              <li>Use “Today” to jump back.</li>
            </ul>
          </div>
        </div>

        
        <UDivider class="my-6" />

        <div class="space-y-4">
          <EventTile />
          <EventTile />
          <EventTile />
          <EventTile />
        </div>
        

      </UCard>

      <div class="h-24"></div>
    </main>

    <!-- Footer -->
    <footer class="fixed inset-x-0 bottom-0 z-10">
      <div class="mx-auto max-w-4xl px-4">
        <div class="h-16 mb-3 rounded-t-3xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-center gap-5 sm:gap-6">
          <button class="w-3 h-3 rounded-full border border-emerald-400/60" aria-label="Tab 1"></button>
          <button class="w-3 h-3 rounded-full border border-emerald-400/60" aria-label="Tab 2"></button>
          <button class="w-4 h-4 rounded-full bg-emerald-500" aria-current="page" aria-label="Tab 3 (active)"></button>
          <button class="w-3 h-3 rounded-full border border-emerald-400/60" aria-label="Tab 4"></button>
          <button class="w-3 h-3 rounded-full border border-emerald-400/60" aria-label="Tab 5"></button>
        </div>
      </div>
    </footer>

  </div>
</template>

