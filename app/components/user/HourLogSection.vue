<script setup lang="ts">
import { formatLongDate } from '#shared/utils/eventTime'
import DetailSection from '~/components/user/DetailSection.vue'
import type { UserData } from '~/types/user/user-data'

/**
 * Hour-log list on the admin member-detail page, with inline editing.
 *
 * Drafts are keyed by log id rather than held as a list, so each row edits
 * independently and the page can submit only the rows that actually changed.
 *
 * NOTE: `totalHours` sums every log regardless of approval status, so the
 * heading here counts pending and rejected hours too. The `hours` figure in the
 * member *list* (`server/api/admin/users.get.ts`) counts approved logs only, so
 * the two numbers legitimately disagree for the same person.
 */
export interface HourLogDraft {
  hours: number
  date: string
  approvalStatus: string
  comment: string
}

const props = defineProps<{
  hourLogs: UserData['hourLogs']
  isEditMode: boolean
}>()

const emit = defineEmits<{
  delete: [log: UserData['hourLogs'][number]]
}>()

// Keyed by hour-log id — parent owns the source of truth,
// this component reads/writes it directly via v-model.
const drafts = defineModel<Record<number, HourLogDraft>>({ required: true })

const approvalStatusOptions = ['Pending', 'Approved', 'Rejected']

// Single neutral badge style used for hour log status
const badgeStyle = 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'

const totalHours = computed(() =>
  props.hourLogs.reduce((sum, log) => sum + log.hours, 0),
)

function formatDate(value: Date | string) {
  return formatLongDate(value)
}
</script>

<template>
  <DetailSection :title="`Hour Log (${totalHours} hrs total)`">
    <p
      v-if="hourLogs.length === 0"
      class="font-normal text-gray-400 dark:text-gray-500"
    >
      No hours logged yet.
    </p>
    <div
      v-else
      class="divide-y divide-gray-200 dark:divide-gray-700"
    >
      <div
        v-for="log in hourLogs"
        :key="log.id"
        class="py-3 flex items-start justify-between gap-3"
      >
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {{ log.eventTitle }}
          </p>

          <template v-if="isEditMode && drafts[log.id]">
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <input
                v-model.number="drafts[log.id].hours"
                type="number"
                step="0.25"
                min="0"
                class="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              >
              <input
                v-model="drafts[log.id].date"
                type="date"
                class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              >
              <select
                v-model="drafts[log.id].approvalStatus"
                class="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
              >
                <option
                  v-for="status in approvalStatusOptions"
                  :key="status"
                  :value="status"
                >
                  {{ status }}
                </option>
              </select>
            </div>
            <input
              v-model="drafts[log.id].comment"
              type="text"
              placeholder="Comment"
              class="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            >
          </template>
          <template v-else>
            <p class="font-normal text-gray-400 dark:text-gray-400 text-sm">
              {{ formatDate(log.date) }} · {{ log.hours }} hrs
            </p>
            <p
              v-if="log.comment"
              class="font-normal text-gray-400 dark:text-gray-400 text-sm italic"
            >
              "{{ log.comment }}"
            </p>
          </template>
        </div>

        <div class="shrink-0 flex items-center gap-2">
          <div
            v-if="!isEditMode"
            class="font-semibold text-[10px] sm:text-xs rounded-full py-0.5 px-2 sm:py-1 sm:px-3"
            :class="badgeStyle"
          >
            {{ log.approvalStatus }}
          </div>
          <UButton
            v-if="isEditMode"
            icon="i-lucide-trash-2"
            variant="ghost"
            color="neutral"
            size="xs"
            class="text-gray-400 dark:text-gray-300"
            @click="emit('delete', log)"
          />
        </div>
      </div>
    </div>
  </DetailSection>
</template>
