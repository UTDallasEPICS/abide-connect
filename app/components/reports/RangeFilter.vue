<script setup lang="ts">
import type { ReportFilterState } from '#shared/types/reports'
import { RANGE_PRESETS, dayKey, resolvePreset } from '#shared/utils/reportRange'

/**
 * The one filter row, sitting above everything it scopes.
 *
 * Choosing a preset fills the custom date boxes with the dates it resolved to,
 * rather than blanking or hiding them. That is the whole trick to "shortcuts
 * plus a custom range": the admin clicks QTD, sees the two dates it means, and
 * can nudge one — at which point the selection becomes Custom on its own. They
 * never have to work out where the quarter started to adjust it by a week.
 *
 * `granularity` and `status` live here too, since both change what every panel
 * on the page is counting and neither belongs inside a single card.
 */

const props = defineProps<{
  modelValue: ReportFilterState
  /** Range the server actually used, echoed back — the header's source of truth. */
  resolvedLabel?: string
  loading?: boolean
  /** The status toggle is hidden on the funder report, which is approved-only. */
  hideStatus?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [ReportFilterState] }>()

function update(patch: Partial<ReportFilterState>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function selectPreset(preset: ReportFilterState['preset']) {
  if (preset === 'CUSTOM') {
    update({ preset })
    return
  }

  // Resolved in the browser purely to populate the two date boxes; the server
  // resolves the preset again for the actual query, so a stale clock here shows
  // a slightly-off placeholder rather than reporting on the wrong period.
  const range = resolvePreset(preset)
  update({
    preset,
    from: dayKey(range.start),
    // `end` is exclusive, so step back a day to show the last day covered.
    to: dayKey(new Date(range.end.getTime() - 86_400_000)),
  })
}

/** Editing either date box means the admin is no longer on a preset. */
function editDate(field: 'from' | 'to', value: string) {
  update({ [field]: value, preset: 'CUSTOM' } as Partial<ReportFilterState>)
}

const statusOptions = [
  { value: 'approved', label: 'Approved only' },
  { value: 'all', label: 'Approved + pending' },
] as const

const granularityOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
] as const
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 shadow-sm"
  >
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="preset in RANGE_PRESETS"
        :key="preset.id"
        type="button"
        class="px-3 py-1.5 rounded-full border text-xs sm:text-sm font-semibold transition-colors"
        :class="modelValue.preset === preset.id
          ? 'bg-teal-600 text-white border-teal-600'
          : 'bg-white dark:bg-gray-900 text-slate-700 dark:text-gray-300 border-slate-300 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-700'"
        :aria-pressed="modelValue.preset === preset.id"
        @click="selectPreset(preset.id)"
      >
        <span class="hidden sm:inline">{{ preset.label }}</span>
        <span class="sm:hidden">{{ preset.short }}</span>
      </button>
    </div>

    <div class="flex flex-wrap items-end gap-3 mt-4">
      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">From</span>
        <input
          :value="modelValue.from"
          type="date"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-1.5"
          @change="editDate('from', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">To</span>
        <input
          :value="modelValue.to"
          type="date"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-1.5"
          @change="editDate('to', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <label
        v-if="!hideStatus"
        class="flex flex-col gap-1"
      >
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Hours counted</span>
        <select
          :value="modelValue.status"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-1.5"
          @change="update({ status: ($event.target as HTMLSelectElement).value as ReportFilterState['status'] })"
        >
          <option
            v-for="option in statusOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Grouping</span>
        <select
          :value="modelValue.granularity"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-1.5"
          @change="update({ granularity: ($event.target as HTMLSelectElement).value as ReportFilterState['granularity'] })"
        >
          <option
            v-for="option in granularityOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <div class="flex items-center gap-2 ml-auto">
        <slot name="actions" />
      </div>
    </div>

    <p
      v-if="resolvedLabel"
      class="mt-3 text-xs font-medium text-slate-500 dark:text-gray-400 flex items-center gap-2"
    >
      <UIcon
        v-if="loading"
        name="i-heroicons-arrow-path"
        class="w-3.5 h-3.5 animate-spin"
      />
      <span>Showing {{ resolvedLabel }}</span>
    </p>
  </div>
</template>
