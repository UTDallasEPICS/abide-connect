<script setup lang="ts">
interface GuestRSVP {
  id: string
  name: string
  email: string
  isVolunteer: boolean
  createdAt: string
}

interface RSVPData {
  volunteerCount: number
  attendeeCount: number
  volunteers: GuestRSVP[]
  attendees: GuestRSVP[]
}

const props = defineProps<{
  eventId: string
  admin: boolean
}>()

const { data: rsvpData, refresh } = await useFetch<RSVPData>(`/api/events/${props.eventId}/rsvp`)

const showVolunteers = ref(false)
const showAttendees = ref(false)

defineExpose({ refresh })
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm p-6 mb-6">
    <h2 class="text-xl font-semibold mb-4">Registrations</h2>

    <div class="flex gap-4">
      <!-- Volunteer count -->
      <div class="flex-1">
        <button
          class="w-full flex items-center justify-between p-4 bg-brand6 rounded-xl"
          :class="admin ? 'cursor-pointer hover:bg-brand6/80' : 'cursor-default'"
          type="button"
          @click="admin && (showVolunteers = !showVolunteers)"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-heart-handshake" class="w-5 h-5 text-brand4" />
            <div class="text-left">
              <p class="text-2xl font-bold text-brand4">{{ rsvpData?.volunteerCount ?? 0 }}</p>
              <p class="text-xs text-gray-500">Volunteers</p>
            </div>
          </div>
          <UIcon v-if="admin" :name="showVolunteers ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-4 h-4 text-gray-400" />
        </button>

        <!-- Volunteer list -->
        <div v-if="admin && showVolunteers" class="mt-2 border border-gray-200 rounded-xl overflow-hidden">
          <div v-if="rsvpData?.volunteers?.length === 0" class="p-4 text-sm text-gray-500 text-center">
            No volunteers yet
          </div>
          <div
            v-for="volunteer in rsvpData?.volunteers"
            :key="volunteer.id"
            class="flex flex-col px-4 py-3 border-b border-gray-100 last:border-0"
          >
            <p class="text-sm font-medium text-gray-900">{{ volunteer.name }}</p>
            <p class="text-xs text-gray-500">{{ volunteer.email }}</p>
          </div>
        </div>
      </div>

      <!-- Attendee count -->
      <div class="flex-1">
        <button
          class="w-full flex items-center justify-between p-4 bg-brand6 rounded-xl"
          :class="admin ? 'cursor-pointer hover:bg-brand6/80' : 'cursor-default'"
          type="button"
          @click="admin && (showAttendees = !showAttendees)"
        >
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-ticket" class="w-5 h-5 text-brand4" />
            <div class="text-left">
              <p class="text-2xl font-bold text-brand4">{{ rsvpData?.attendeeCount ?? 0 }}</p>
              <p class="text-xs text-gray-500">Attendees</p>
            </div>
          </div>
          <UIcon v-if="admin" :name="showAttendees ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="w-4 h-4 text-gray-400" />
        </button>

        <!-- Attendee list -->
        <div v-if="admin && showAttendees" class="mt-2 border border-gray-200 rounded-xl overflow-hidden">
          <div v-if="rsvpData?.attendees?.length === 0" class="p-4 text-sm text-gray-500 text-center">
            No attendees yet
          </div>
          <div
            v-for="attendee in rsvpData?.attendees"
            :key="attendee.id"
            class="flex flex-col px-4 py-3 border-b border-gray-100 last:border-0"
          >
            <p class="text-sm font-medium text-gray-900">{{ attendee.name }}</p>
            <p class="text-xs text-gray-500">{{ attendee.email }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>