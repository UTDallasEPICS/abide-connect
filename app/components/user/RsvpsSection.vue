<script setup lang="ts">
import DetailSection from '~/components/user/DetailSection.vue'
import type { UserData } from '~/types/user/user-data'

/**
 * Sign-up list on the admin member-detail page.
 *
 * Only `isVolunteer` is editable — the event and its times belong to the event,
 * not the RSVP. Drafts are keyed by `eventId`, which is what identifies an RSVP
 * for a given user (the API routes are `/api/rsvp/<userId>/<eventId>`).
 *
 * Account-holder RSVPs only; guest sign-ups aren't tied to a user and never
 * appear here.
 */
export interface RsvpDraft {
  isVolunteer: boolean
}

defineProps<{
  rsvps: UserData['rsvps']
  isEditMode: boolean
}>()

const emit = defineEmits<{
  delete: [rsvp: UserData['rsvps'][number]]
}>()

// Keyed by eventId — parent owns the source of truth,
// this component reads/writes it directly via v-model.
const drafts = defineModel<Record<string, RsvpDraft>>({ required: true })

// Single neutral badge style used for RSVP type
const badgeStyle = 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <DetailSection :title="`RSVPs (${rsvps.length})`">
    <p
      v-if="rsvps.length === 0"
      class="font-normal text-gray-400 dark:text-gray-500"
    >
      No RSVPs yet.
    </p>
    <div
      v-else
      class="divide-y divide-gray-200 dark:divide-gray-700"
    >
      <div
        v-for="rsvp in rsvps"
        :key="rsvp.eventId"
        class="py-3 flex items-start justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {{ rsvp.eventTitle }}
          </p>
          <p class="font-normal text-gray-400 dark:text-gray-400 text-sm">
            {{ formatDateTime(rsvp.startTime) }} – {{ formatDateTime(rsvp.endTime) }}
          </p>
          <label
            v-if="isEditMode && drafts[rsvp.eventId]"
            class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mt-1"
          >
            <input
              v-model="drafts[rsvp.eventId].isVolunteer"
              type="checkbox"
            >
            Attending as volunteer
          </label>
        </div>

        <div class="shrink-0 flex items-center gap-2">
          <div
            v-if="!isEditMode"
            class="font-semibold text-[10px] sm:text-xs rounded-full py-0.5 px-2 sm:py-1 sm:px-3"
            :class="badgeStyle"
          >
            {{ rsvp.isVolunteer ? 'Volunteer' : 'Attendee' }}
          </div>
          <UButton
            v-if="isEditMode"
            icon="i-lucide-trash-2"
            variant="ghost"
            color="neutral"
            size="xs"
            class="text-gray-400 dark:text-gray-300"
            @click="emit('delete', rsvp)"
          />
        </div>
      </div>
    </div>
  </DetailSection>
</template>
