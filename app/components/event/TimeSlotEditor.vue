<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatTimeRange, fromDateTimeLocal } from '#shared/utils/eventTime'
import { validateTimeSlot } from '#shared/utils/timeSlot'

/**
 * Editor for the time blocks on an event.
 *
 * Blocks are hand-drawn: they may overlap each other and may be different
 * lengths, which is the clinic's actual workflow — an all-day block plus a
 * short one over the busy hour means extra hands on top of the people already
 * there. Nothing here is persisted; the parent's save button does that.
 */

interface TimeSlotRow {
  /** Present on blocks that already exist. Absent ones are created on save. */
  id: string | null
  /** `datetime-local` strings, i.e. wall-clock time in the org's timezone. */
  startTime: string
  endTime: string
  capacity: number
  /** Confirmed signups, from the API. Drives the removal warning. */
  signupCount?: number
}

const props = withDefaults(defineProps<{
  modelValue: TimeSlotRow[]
  /** The event's own window, as `datetime-local` strings. */
  eventStart: string
  eventEnd: string
  /**
   * Create flow only: drop in one block spanning the whole event as soon as
   * it has times. Never on edit — an existing event with no blocks must not
   * silently gain one just because an admin opened the form.
   */
  seedWhenEmpty?: boolean
  color?: string
}>(), {
  seedWhenEmpty: false,
  color: 'primary',
})

const emit = defineEmits<{ 'update:modelValue': [TimeSlotRow[]] }>()

const hasWindow = computed(() => !!props.eventStart && !!props.eventEnd)

const slotWindow = computed(() => ({
  startTime: fromDateTimeLocal(props.eventStart),
  endTime: fromDateTimeLocal(props.eventEnd),
}))

/** Row being confirmed for removal, by index. */
const pendingRemoval = ref<number | null>(null)

function commit(rows: TimeSlotRow[]) {
  emit('update:modelValue', rows)
}

function updateRow(index: number, patch: Partial<TimeSlotRow>) {
  commit(props.modelValue.map((row, i) => (i === index ? { ...row, ...patch } : row)))
}

function addRow() {
  if (!hasWindow.value) return

  // Start where the last block ended, so consecutive shifts need almost no
  // typing. Fall back to the event start once the day is used up.
  const last = props.modelValue[props.modelValue.length - 1]
  const start = last && last.endTime < props.eventEnd ? last.endTime : props.eventStart

  commit([
    ...props.modelValue,
    { id: null, startTime: start, endTime: props.eventEnd, capacity: 1 },
  ])
}

function removeRow(index: number) {
  pendingRemoval.value = null
  commit(props.modelValue.filter((_, i) => i !== index))
}

function requestRemoval(index: number) {
  // Only blocks with people in them need confirming.
  if ((props.modelValue[index]?.signupCount ?? 0) > 0) {
    pendingRemoval.value = index
    return
  }
  removeRow(index)
}

/** Keep an untouched full-window block in step with the event's own times. */
let previousWindow = { start: props.eventStart, end: props.eventEnd }

watch(
  () => [props.eventStart, props.eventEnd] as const,
  ([start, end]) => {
    const moved = props.modelValue.map(row =>
      row.startTime === previousWindow.start && row.endTime === previousWindow.end
        ? { ...row, startTime: start, endTime: end }
        : row,
    )

    previousWindow = { start, end }

    // Create flow: the event now has times and no blocks, so give it the
    // default one spanning the whole thing.
    if (props.seedWhenEmpty && moved.length === 0 && start && end) {
      commit([{ id: null, startTime: start, endTime: end, capacity: 1 }])
      return
    }

    if (moved.some((row, i) => row !== props.modelValue[i])) commit(moved)
  },
  { immediate: true },
)

function rowProblem(row: TimeSlotRow): string | null {
  if (!hasWindow.value) return null

  const problem = validateTimeSlot(
    {
      id: row.id,
      startTime: fromDateTimeLocal(row.startTime),
      endTime: fromDateTimeLocal(row.endTime),
      capacity: Number(row.capacity),
    },
    slotWindow.value,
  )

  // The shared rules return a sentence fragment so each caller can name the
  // block its own way; here the row itself is the subject.
  return problem ? `This block ${problem}.` : null
}

function rowRange(row: TimeSlotRow): string {
  return formatTimeRange(fromDateTimeLocal(row.startTime), fromDateTimeLocal(row.endTime))
}

function removalWarning(row: TimeSlotRow): string {
  const n = row.signupCount ?? 0
  return `${n} volunteer${n === 1 ? ' is' : 's are'} signed up for the ${rowRange(row)} block. `
    + 'Removing it will cancel their sign-ups when you save. They will not be '
    + 'notified automatically — you\'ll need to contact them.'
}

const totalSpots = computed(() =>
  props.modelValue.reduce((sum, row) => sum + (Number(row.capacity) || 0), 0),
)
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
          Volunteer Time Blocks
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Shifts volunteers sign up for. Blocks can overlap and can be different lengths.
        </p>
      </div>

      <UButton
        icon="i-lucide-plus"
        size="sm"
        variant="soft"
        :color="color"
        :disabled="!hasWindow"
        @click="addRow"
      >
        Add block
      </UButton>
    </div>

    <p
      v-if="!hasWindow"
      class="text-xs text-gray-500 dark:text-gray-400 italic"
    >
      Set the event start and end times first.
    </p>

    <p
      v-else-if="modelValue.length === 0"
      class="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-4 py-3 text-xs text-gray-500 dark:text-gray-400"
    >
      No time blocks. Volunteers sign up for the whole event, and their logged
      hours cover its full length.
    </p>

    <div
      v-for="(row, index) in modelValue"
      :key="row.id ?? `new-${index}`"
      class="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
    >
      <!-- Warning shown in place of the row, so it names the block being removed -->
      <div
        v-if="pendingRemoval === index"
        class="space-y-3"
      >
        <p class="text-sm text-amber-700 dark:text-amber-400">
          {{ removalWarning(row) }}
        </p>
        <div class="flex justify-end gap-2">
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            @click="pendingRemoval = null"
          >
            Keep block
          </UButton>
          <UButton
            size="sm"
            color="error"
            @click="removeRow(index)"
          >
            Remove anyway
          </UButton>
        </div>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex-1 min-w-[10rem]">
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start</label>
            <UInput
              type="datetime-local"
              :model-value="row.startTime"
              class="w-full"
              @update:model-value="value => updateRow(index, { startTime: String(value) })"
            />
          </div>

          <div class="flex-1 min-w-[10rem]">
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">End</label>
            <UInput
              type="datetime-local"
              :model-value="row.endTime"
              class="w-full"
              @update:model-value="value => updateRow(index, { endTime: String(value) })"
            />
          </div>

          <div class="w-24">
            <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Spots</label>
            <UInput
              type="number"
              min="1"
              :model-value="row.capacity"
              @update:model-value="value => updateRow(index, { capacity: Number(value) })"
            />
          </div>

          <UButton
            icon="i-lucide-trash-2"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="`Remove the ${rowRange(row)} block`"
            @click="requestRemoval(index)"
          />
        </div>

        <p
          v-if="rowProblem(row)"
          class="mt-2 text-xs text-red-600 dark:text-red-400"
        >
          {{ rowProblem(row) }}
        </p>

        <!-- Cutting capacity below the number already signed up is allowed:
             code shouldn't pick whose sign-up dies. It just has to be visible. -->
        <p
          v-else-if="(row.signupCount ?? 0) > Number(row.capacity)"
          class="mt-2 text-xs text-amber-700 dark:text-amber-400"
        >
          {{ row.signupCount }} already signed up, but this block now has
          {{ row.capacity }} spot{{ Number(row.capacity) === 1 ? '' : 's' }}. Nobody is
          removed automatically — the block will simply be over capacity.
        </p>

        <p
          v-else-if="(row.signupCount ?? 0) > 0"
          class="mt-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ row.signupCount }} of {{ row.capacity }} spots taken.
        </p>
      </template>
    </div>

    <p
      v-if="modelValue.length > 0"
      class="text-xs text-gray-500 dark:text-gray-400"
    >
      {{ modelValue.length }} block{{ modelValue.length === 1 ? '' : 's' }},
      {{ totalSpots }} volunteer spot{{ totalSpots === 1 ? '' : 's' }} in total.
    </p>
  </div>
</template>
