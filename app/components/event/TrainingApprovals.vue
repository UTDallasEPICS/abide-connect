<script setup lang="ts">
import type { TrainingAttendee } from './TrainingApprovalList.vue'

const props = defineProps<{
  eventId: string
}>()

// Admin-only endpoint, so the session cookie has to ride along on SSR.
const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: attendees, refresh, pending } = await useFetch<TrainingAttendee[]>(
  `/api/events/${props.eventId}/training-attendees`,
  { headers, default: () => [] },
)
</script>

<template>
  <div class="dark:bg-gray-800 rounded-2xl shadow-sm dark:shadow-black/20 p-6 mb-6 border border-transparent dark:border-gray-700 shadow-md">
    <div class="flex items-center gap-3 mb-4">
      <div class="bg-brand6 dark:bg-gray-700 p-3 rounded-xl">
        <UIcon
          name="i-lucide-graduation-cap"
          class="w-6 h-6 text-brand4 dark:text-brand8"
        />
      </div>
      <div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          Volunteer Approvals
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Approve or deny volunteers who attended this training.
        </p>
      </div>
    </div>

    <div
      v-if="pending"
      class="flex justify-center items-center h-20"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="w-5 h-5 animate-spin text-brand4 dark:text-brand8"
      />
    </div>

    <EventTrainingApprovalList
      v-else
      :attendees="attendees"
      @updated="refresh"
    />
  </div>
</template>
