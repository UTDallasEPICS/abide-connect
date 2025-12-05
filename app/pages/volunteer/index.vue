<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'

const tz = getLocalTimeZone()

const value = ref<DateValue>(today(tz))
const volunteer = await $fetch('/api/volunteer/me')
const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))

// Upcoming events they signed up for
const upcomingEvents = ref([
  { id: 1, title: 'Community Cleanup', date: 'Apr 15, 2024', hours: 3 },
  { id: 2, title: 'Food Bank Volunteer', date: 'Apr 18, 2024', hours: 4 },
  { id: 3, title: 'Youth Mentoring', date: 'Apr 22, 2024', hours: 2 },
])

// Hour logs
const approvedLogs = ref([
  { id: 1, event: 'Park Cleanup', hours: 3, date: 'Mar 10, 2024' },
  { id: 2, event: 'Library Support', hours: 2, date: 'Mar 5, 2024' },
])

const deniedLogs = ref([
  { id: 1, event: 'Street Fair', hours: 5, date: 'Mar 1, 2024', reason: 'Incorrect documentation' },
])

const pendingLogs = ref([
  { id: 1, event: 'Beach Cleanup', hours: 4, date: 'Mar 20, 2024' },
  { id: 2, event: 'Animal Shelter', hours: 3, date: 'Mar 22, 2024' },
])

// Toggle states for accordions
const showApproved = ref(false)
const showDenied = ref(false)
const showPending = ref(false)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white">
    <main class="flex-1 px-4 pt-24 pb-24">
      <div class="max-w-4xl mx-auto space-y-6">
        <h2 class="text-2xl font-semibold text-brand4 mb-4">Welcome back, {{ volunteer?.name }}</h2>
        <!-- Calendar Card -->
        <UCard>
          <UCalendar
            :v-model="value"
            color="brand4"
            :is-date-disabled="isDateDisabled"
            locale="en-US"
            weekday-format="short"
            :first-day-of-week="0"
            class="rounded-2xl"
          />
        </UCard>

        <!-- Upcoming Events (Signed Up) -->
        <UCard>
          <template #header>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Upcoming Events
            </h3>
          </template>
          
          <div class="space-y-2">
            <div
              v-for="event in upcomingEvents"
              :key="event.id"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <div>
                <p class="font-medium text-sm">{{ event.title }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ event.date }}</p>
              </div>
              <span class="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                {{ event.hours }}h
              </span>
            </div>
          </div>
        </UCard>

        <!-- Hour Logs -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Hour Logs</h3>
              <UButton icon="i-heroicons-plus" size="sm" color="brand4" />
            </div>
          </template>

          <div class="space-y-3">
            
            <!-- Approved -->
            <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <button
                @click="showApproved = !showApproved"
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span class="font-medium">Approved</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    {{ approvedLogs.length }}
                  </span>
                </div>
                <UIcon
                  :name="showApproved ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="w-5 h-5 text-gray-400"
                />
              </button>
              
              <div v-if="showApproved" class="p-4 pt-0 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                <div
                  v-for="log in approvedLogs"
                  :key="log.id"
                  class="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-medium text-sm">{{ log.event }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ log.date }}</p>
                    </div>
                    <span class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {{ log.hours }}h
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Denied -->
            <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <button
                @click="showDenied = !showDenied"
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full bg-red-500"></div>
                  <span class="font-medium">Denied</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    {{ deniedLogs.length }}
                  </span>
                </div>
                <UIcon
                  :name="showDenied ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="w-5 h-5 text-gray-400"
                />
              </button>
              
              <div v-if="showDenied" class="p-4 pt-0 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                <div
                  v-for="log in deniedLogs"
                  :key="log.id"
                  class="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div>
                      <p class="font-medium text-sm">{{ log.event }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ log.date }}</p>
                    </div>
                    <span class="text-sm font-medium text-red-600 dark:text-red-400">
                      {{ log.hours }}h
                    </span>
                  </div>
                  <p class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {{ log.reason }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Pending -->
            <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <button
                @click="showPending = !showPending"
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span class="font-medium">Pending</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {{ pendingLogs.length }}
                  </span>
                </div>
                <UIcon
                  :name="showPending ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                  class="w-5 h-5 text-gray-400"
                />
              </button>
              
              <div v-if="showPending" class="p-4 pt-0 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                <div
                  v-for="log in pendingLogs"
                  :key="log.id"
                  class="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-medium text-sm">{{ log.event }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ log.date }}</p>
                    </div>
                    <span class="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {{ log.hours }}h
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </UCard>

      </div>
    </main>

   
  </div>
</template>