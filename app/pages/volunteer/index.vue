<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'

const tz = getLocalTimeZone()

// The session data bugs unuless we pass the cookie header to the fetch request
const headers = useRequestHeaders(['cookie']);
const volunteer = await useFetch('/api/volunteer/me', { headers }).data.value;
const user = await useFetch('/api/user/me', { headers }).data.value;


const value = ref<DateValue>(today(tz))
const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))

// Upcoming events they signed up for
const upcomingEvents = ref([
  { id: 1, title: 'Community Cleanup', date: 'Apr 15, 2024', hours: 3 },
  { id: 2, title: 'Food Bank Volunteer', date: 'Apr 18, 2024', hours: 4 },
  { id: 3, title: 'Youth Mentoring', date: 'Apr 22, 2024', hours: 2 },
])

// Hour logs
interface HourLog {
  id: string
  eventId: string
  event: { title: string }
  date: string
  hours: number
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  comment?: string
}


const { logs } = await $fetch<{ logs: HourLog[] }>('/api/volunteer/logs', { headers })
const logsRef = ref<HourLog[]>(logs)

const approvedLogs = computed(() => logsRef.value.filter(l => l.approvalStatus === 'APPROVED'))
const pendingLogs = computed(() => logsRef.value.filter(l => l.approvalStatus === 'PENDING'))
const deniedLogs = computed(() => logsRef.value.filter(l => l.approvalStatus === 'REJECTED'))

// Toggle states for accordions
const showApproved = ref(false)
const showDenied = ref(false)
const showPending = ref(false)

// Anyone signed in can open their profile. People who haven't applied to
// volunteer get the prompt below; the volunteer-only sections stay hidden
// until they have something to show.
const { isVolunteer } = useUserRoles()
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
    <main class="flex-1 px-4 pt-24 pb-24">
      <div class="max-w-4xl mx-auto space-y-6">
        <h2 class="text-center text-2xl font-bold text-brand4 dark:text-teal-400">
          Welcome back, {{ user?.name}}
        </h2>

        <!-- Volunteer application prompt (users who haven't applied yet) -->
        <NuxtLink
          v-if="!isVolunteer"
          to="/volunteer-application"
          class="flex items-center justify-between gap-3 rounded-xl bg-brand4/10 border border-brand4/30 px-4 py-3 hover:bg-brand4/15 transition-colors"
        >
          <div>
            <p class="text-sm font-semibold text-brand4">
              Want to volunteer with us?
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              Submit your volunteer application to get started.
            </p>
          </div>
          <UIcon
            name="i-lucide-arrow-right"
            class="w-5 h-5 text-brand4 shrink-0"
          />
        </NuxtLink>

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

        <!-- Volunteer-only sections; hidden until someone has applied -->
        <template v-if="isVolunteer">
          <!-- Upcoming Events (Signed Up) -->
          <h3 class="text-lg font-semibold text-brand4 mb-4">
            Upcoming Events
          </h3>
          <div class="space-y-4">
            <div
              v-for="event in upcomingEvents"
              :key="event.id"
              class="flex items-center justify-between p-3 rounded-lg border border-gray-200"
            >
              <div>
                <p class="font-medium text-sm">
                  {{ event.title }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ event.date }}
                </p>
              </div>
              <span
                class="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              >
                {{ event.hours }}h
              </span>
            </div>
          </div>

          <!-- Hour Logs -->
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-brand4">
              Hour Logs
            </h3>
            <UButton
              icon="i-lucide-plus"
              size="sm"
              color="brand4"
              label="Log Your Hours"
            />
          </div>

          <div class="space-y-3">
            <!-- In Review -->
            <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <button
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                @click="showPending = !showPending"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full bg-amber-500" />
                  <span class="font-medium">In Review</span>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  >
                    {{ pendingLogs.length }}
                  </span>
                </div>
                <UIcon
                  :name="showPending
                    ? 'i-heroicons-chevron-up'
                    : 'i-heroicons-chevron-down'
                  "
                  class="w-5 h-5 text-gray-400"
                />
              </button>

              <div
                v-if="showPending"
                class="p-4 pt-0 space-y-2 bg-gray-50 dark:bg-gray-900/50"
              >
                <div
                  v-for="log in pendingLogs"
                  :key="log.id"
                  class="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-medium text-sm">
                        {{ log.event.title }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ log.date }}
                      </p>
                    </div>
                    <span class="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {{ log.hours }}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <!-- Approved -->
            <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              <button
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                @click="showApproved = !showApproved"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full bg-emerald-500" />
                  <span class="font-medium">Approved</span>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  >
                    {{ approvedLogs.length }}
                  </span>
                </div>
                <UIcon
                  :name="showApproved
                    ? 'i-heroicons-chevron-up'
                    : 'i-heroicons-chevron-down'
                  "
                  class="w-5 h-5 text-gray-400"
                />
              </button>

              <div
                v-if="showApproved"
                class="p-4 pt-0 space-y-2 bg-gray-50 dark:bg-gray-900/50"
              >
                <div
                  v-for="log in approvedLogs"
                  :key="log.id"
                  class="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div class="flex items-start justify-between">
                    <div>
                      <p class="font-medium text-sm">
                        {{ log.event.title }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ log.date }}
                      </p>
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
                class="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                @click="showDenied = !showDenied"
              >
                <div class="flex items-center gap-3">
                  <div class="w-2 h-2 rounded-full bg-red-500" />
                  <span class="font-medium">Denied</span>
                  <span
                    class="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  >
                    {{ deniedLogs.length }}
                  </span>
                </div>
                <UIcon
                  :name="showDenied
                    ? 'i-heroicons-chevron-up'
                    : 'i-heroicons-chevron-down'
                  "
                  class="w-5 h-5 text-gray-400"
                />
              </button>

              <div
                v-if="showDenied"
                class="p-4 pt-0 space-y-2 bg-gray-50 dark:bg-gray-900/50"
              >
                <div
                  v-for="log in deniedLogs"
                  :key="log.id"
                  class="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <div class="flex items-start justify-between mb-2">
                    <div>
                      <p class="font-medium text-sm">
                        {{ log.event.title }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ log.date }}
                      </p>
                    </div>
                    <span class="text-sm font-medium text-red-600 dark:text-red-400">
                      {{ log.hours }}h
                    </span>
                  </div>
                  <p class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {{ log.comment }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
