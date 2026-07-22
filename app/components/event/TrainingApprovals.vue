<script setup lang="ts">
interface TrainingAttendee {
  userId: string
  volunteerId: string
  name: string
  email: string
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
}

const props = defineProps<{
  eventId: string
}>()

const { data: attendees, refresh, pending } = await useFetch<TrainingAttendee[]>(
  `/api/events/${props.eventId}/training-attendees`,
  { default: () => [] },
)

const actioningId = ref<string | null>(null)

async function setApproval(volunteerId: string, status: 'APPROVED' | 'REJECTED') {
  actioningId.value = volunteerId
  try {
    await $fetch(`/api/volunteer/${volunteerId}/approval`, {
      method: 'PATCH',
      body: { status },
    })
    await refresh()
  }
  catch (err) {
    console.error('Failed to update volunteer approval:', err)
  }
  finally {
    actioningId.value = null
  }
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  APPROVED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}
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

    <div
      v-else-if="attendees.length === 0"
      class="text-sm text-gray-500 dark:text-gray-400 text-center py-6"
    >
      No volunteers have signed up for this training yet.
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-for="attendee in attendees"
        :key="attendee.volunteerId"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
            {{ attendee.name || 'Unnamed volunteer' }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ attendee.email }}
          </p>
        </div>

        <!-- Approved volunteers are done; everyone else (pending or previously
             rejected) can still be actioned so a rejection is never a dead end. -->
        <span
          v-if="attendee.approvalStatus === 'APPROVED'"
          class="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
          :class="statusStyles.APPROVED"
        >
          approved
        </span>

        <div
          v-else
          class="flex items-center gap-2"
        >
          <span
            v-if="attendee.approvalStatus === 'REJECTED'"
            class="text-xs font-medium px-2.5 py-1 rounded-full capitalize"
            :class="statusStyles.REJECTED"
          >
            rejected
          </span>
          <UButton
            color="brand4"
            size="sm"
            icon="i-lucide-check"
            :loading="actioningId === attendee.volunteerId"
            @click="setApproval(attendee.volunteerId, 'APPROVED')"
          >
            Approve
          </UButton>
          <UButton
            v-if="attendee.approvalStatus === 'PENDING'"
            color="brand7"
            variant="soft"
            size="sm"
            icon="i-lucide-x"
            :loading="actioningId === attendee.volunteerId"
            @click="setApproval(attendee.volunteerId, 'REJECTED')"
          >
            Deny
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
