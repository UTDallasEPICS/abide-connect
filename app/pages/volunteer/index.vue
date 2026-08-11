<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { getLocalTimeZone, today } from '@internationalized/date'

/**
 * The signed-in user's profile: their details, sign-ups, and hour logs.
 *
 * Guarded by `auth.global.ts` as `/volunteer` → role `user`, deliberately not
 * `volunteer` — anyone signed in can open it, and those who haven't applied see
 * a prompt to apply rather than being bounced. `useUserRoles().isVolunteer`
 * below is what toggles the volunteer-only sections.
 */

const tz = getLocalTimeZone()

// The session data bugs unuless we pass the cookie header to the fetch request
const headers = useRequestHeaders(['cookie'])
// Keep the ref useFetch hands back and await the request itself. Reading
// `.data.value` off the un-awaited call snapshots it while it's still null,
// which leaves the name blank on any client-side navigation (e.g. the
// redirect straight after sign-in).
const { data: user } = await useFetch('/api/user/me', { headers })

const value = ref<DateValue>(today(tz))
const isDateDisabled = (d: DateValue) =>
  d.toDate(tz) < new Date(new Date().setHours(0, 0, 0, 0))

// Upcoming events they signed up for, either as a volunteer or an attendee.
interface UpcomingEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  address: string | null
  isTraining: boolean
  isVolunteer: boolean
  imageUrl: string | null
}

const { data: upcomingEvents } = await useFetch<UpcomingEvent[]>(
  '/api/user/upcoming-events',
  { headers, default: () => [] },
)

/** Local-time `YYYY-MM-DD`, the key the calendar pips are looked up by. */
const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

// Which kinds of sign-up fall on each day, so the calendar can mark them.
// An event contributes an entry for every day it spans, not just its first.
const signUpsByDate = computed(() => {
  const days = new Map<string, { volunteering: boolean, attending: boolean }>()

  for (const event of upcomingEvents.value ?? []) {
    const cursor = new Date(event.startTime)
    cursor.setHours(0, 0, 0, 0)
    const last = new Date(event.endTime)
    last.setHours(0, 0, 0, 0)

    // Always marks the start day, then walks to the end. Bounded so bad data
    // (an endTime before its startTime, or a wildly long range) can't hang the
    // render.
    for (let i = 0; i < 366; i++) {
      const key = toDateKey(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
      const day = days.get(key) ?? { volunteering: false, attending: false }

      if (event.isVolunteer) day.volunteering = true
      else day.attending = true

      days.set(key, day)

      if (cursor >= last) break
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return days
})

// Fills the whole day cell, using the same colors as the badges on the
// Upcoming Events list below: emerald for volunteering/training, sky for
// attending.
const DAY_HIGHLIGHTS = {
  volunteering: {
    label: 'Volunteering',
    class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  attending: {
    label: 'Attending',
    class: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  },
  // A hard-stop gradient rather than a blend, so a day with both keeps each
  // half at its exact badge color instead of turning teal down the middle.
  both: {
    label: 'Volunteering and attending',
    class: 'bg-[linear-gradient(to_right,var(--color-emerald-100)_50%,var(--color-sky-100)_50%)] text-gray-900 '
      + 'dark:bg-[linear-gradient(to_right,var(--color-emerald-900)_50%,var(--color-sky-900)_50%)] dark:text-white',
  },
}

const highlightForDay = (day: DateValue) => {
  const signUps = signUpsByDate.value.get(toDateKey(day.year, day.month, day.day))
  if (!signUps) return null
  if (signUps.volunteering && signUps.attending) return DAY_HIGHLIGHTS.both
  return signUps.volunteering ? DAY_HIGHLIGHTS.volunteering : DAY_HIGHLIGHTS.attending
}

const hasSignUps = computed(() => signUpsByDate.value.size > 0)

const formatEventDate = (event: UpcomingEvent) => {
  const start = new Date(event.startTime)
  const date = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const time = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date} · ${time}`
}

// Hour logs
interface HourLog {
  id: string
  event: string
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
const showLogModal = ref(false)

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
          Welcome back, {{ user?.name }}
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
          >
            <template #day="{ day }">
              <span
                v-if="highlightForDay(day)"
                :class="[
                  'absolute inset-0 flex items-center justify-center rounded-full font-semibold',
                  highlightForDay(day)?.class,
                ]"
              >
                {{ day.day }}
                <span class="sr-only">, {{ highlightForDay(day)?.label }}</span>
              </span>
              <template v-else>
                {{ day.day }}
              </template>
            </template>
          </UCalendar>

          <!-- Key for the shaded days; pointless when nothing is marked. -->
          <div
            v-if="hasSignUps"
            class="flex items-center justify-center gap-4 pt-3 text-xs text-gray-500 dark:text-gray-400"
          >
            <span class="flex items-center gap-1.5">
              <span class="size-3 rounded-full bg-emerald-100 dark:bg-emerald-900/50" />
              Volunteering
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-3 rounded-full bg-sky-100 dark:bg-sky-900/50" />
              Attending
            </span>
          </div>
        </UCard>

        <!-- Upcoming Events (Signed Up) — everyone with an account sees these,
             since attendee sign-ups don't require a volunteer profile. -->
        <div>
          <h3 class="text-lg font-semibold text-brand4 mb-4">
            Upcoming Events
          </h3>
          <div
            v-if="upcomingEvents?.length"
            class="space-y-4"
          >
            <NuxtLink
              v-for="event in upcomingEvents"
              :key="event.id"
              :to="`/events/${event.id}`"
              class="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div class="min-w-0">
                <p class="font-medium text-sm truncate">
                  {{ event.title }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatEventDate(event) }}
                </p>
                <p
                  v-if="event.address"
                  class="text-xs text-gray-500 dark:text-gray-400 truncate"
                >
                  {{ event.address }}
                </p>
              </div>
              <span
                v-if="event.isVolunteer"
                class="text-xs px-2 py-1 rounded-full shrink-0 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              >
                {{ event.isTraining ? 'Training' : 'Volunteering' }}
              </span>
              <span
                v-else
                class="text-xs px-2 py-1 rounded-full shrink-0 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400"
              >
                Attending
              </span>
            </NuxtLink>
          </div>
          <p
            v-else
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            You haven't signed up for any upcoming events.
            <NuxtLink
              to="/events"
              class="text-brand4 hover:underline"
            >
              Browse events
            </NuxtLink>
          </p>
        </div>

        <!-- Volunteer-only sections; hidden until someone has applied -->
        <template v-if="isVolunteer">
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
              @click="() => { showLogModal = true }"
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
                        {{ log.event }}
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
                        {{ log.event }}
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
                        {{ log.event }}
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
    <Teleport to="body">
      <div
        v-if="showLogModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4"
        @click.self="showLogModal = false"
      >
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
          <VolunteerHourLogModal
            @save="showLogModal = false"
            @close="showLogModal = false"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
