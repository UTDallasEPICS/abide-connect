<script setup lang="ts">
import { useColorMode } from '#imports'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

/**
 * One person on the list. `phone` is blank for accounts that never filled one
 * in, and always blank for `isGuest` rows — those are legacy sign-ups from
 * before an account was required, and only ever held a name and email.
 */
interface EventRegistration {
  id: string
  name: string
  email: string
  phone: string
  isVolunteer: boolean
  isGuest: boolean
}

interface RSVPData {
  volunteerCount: number
  attendeeCount: number
  volunteers: EventRegistration[]
  attendees: EventRegistration[]
}

/**
 * Registration counts for an event, with expandable name/email lists.
 *
 * `admin` controls only whether the lists can be expanded — the counts show to
 * anyone. Note the endpoint behind this is admin-only regardless, so for a
 * non-admin the fetch fails and the counts render empty rather than zero.
 *
 * `refresh` is exposed so the parent event page can refetch after an RSVP
 * without re-rendering the whole panel.
 */
const props = defineProps<{
  eventId: string
  admin: boolean
}>()

// Admin-only endpoint, so the session cookie has to ride along on SSR.
const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: rsvpData, refresh } = await useFetch<RSVPData>(
  `/api/events/${props.eventId}/rsvp`,
  { headers },
)

/** Email, plus the phone number when the account has one on file. */
function contactLine(person: EventRegistration): string {
  return [person.email, person.phone].filter(Boolean).join(' · ')
}

const showVolunteers = ref(false)
const showAttendees = ref(false)

defineExpose({ refresh })
</script>

<template>
  <div class="dark:bg-gray-800 rounded-2xl shadow-sm dark:shadow-black/20 p-6 mb-6 border border-transparent dark:border-gray-700 shadow-md">
    <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
      Registrations
    </h2>

    <div class="flex gap-4">
      <!-- Volunteer count -->
      <div class="flex-1">
        <button
          class="w-full flex items-center justify-between p-4 bg-brand6 dark:bg-brand6/20 rounded-xl"
          :class="admin ? 'cursor-pointer hover:bg-brand6/80 dark:hover:bg-brand6/30' : 'cursor-default'"
          type="button"
          @click="admin && (showVolunteers = !showVolunteers)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-heart-handshake"
              class="w-5 h-5 text-brand4 dark:text-brand8"
            />
            <div class="text-left">
              <p class="text-2xl font-bold text-brand4 dark:text-brand8">
                {{ rsvpData?.volunteerCount ?? 0 }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Volunteers
              </p>
            </div>
          </div>
          <UIcon
            v-if="admin"
            :name="showVolunteers ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-gray-400 dark:text-gray-500"
          />
        </button>

        <!-- Volunteer list -->
        <div
          v-if="admin && showVolunteers"
          class="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
        >
          <div
            v-if="rsvpData?.volunteers?.length === 0"
            class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            No volunteers yet
          </div>
          <div
            v-for="volunteer in rsvpData?.volunteers"
            :key="volunteer.id"
            class="flex flex-col px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-white dark:bg-gray-900"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ volunteer.name }}
              <UBadge
                v-if="volunteer.isGuest"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                guest
              </UBadge>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ contactLine(volunteer) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Attendee count -->
      <div class="flex-1">
        <button
          class="w-full flex items-center justify-between p-4 bg-brand6 dark:bg-brand6/20 rounded-xl"
          :class="admin ? 'cursor-pointer hover:bg-brand6/80 dark:hover:bg-brand6/30' : 'cursor-default'"
          type="button"
          @click="admin && (showAttendees = !showAttendees)"
        >
          <div class="flex items-center gap-3">
            <UIcon
              name="i-lucide-ticket"
              class="w-5 h-5 text-brand4 dark:text-brand8"
            />
            <div class="text-left">
              <p class="text-2xl font-bold text-brand4 dark:text-brand8">
                {{ rsvpData?.attendeeCount ?? 0 }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Attendees
              </p>
            </div>
          </div>
          <UIcon
            v-if="admin"
            :name="showAttendees ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="w-4 h-4 text-gray-400 dark:text-gray-500"
          />
        </button>

        <!-- Attendee list -->
        <div
          v-if="admin && showAttendees"
          class="mt-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
        >
          <div
            v-if="rsvpData?.attendees?.length === 0"
            class="p-4 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            No attendees yet
          </div>
          <div
            v-for="attendee in rsvpData?.attendees"
            :key="attendee.id"
            class="flex flex-col px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-white dark:bg-gray-900"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ attendee.name }}
              <UBadge
                v-if="attendee.isGuest"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                guest
              </UBadge>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ contactLine(attendee) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>