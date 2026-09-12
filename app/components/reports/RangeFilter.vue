<script setup lang="ts">
import type { ReportFilterState } from '#shared/types/reports'
import { RANGE_PRESETS, dayKey, resolvePreset } from '#shared/utils/reportRange'

/**
 * The one filter row, sitting above everything it scopes.
 *
 * The presets are a dropdown rather than a row of chips: nine of them spelled
 * out took two lines and read as the loudest thing on a page whose point is the
 * numbers below it. The resolved range is still stated underneath ("Showing
 * Jan 1 – Aug 13, 2026"), so nothing is lost by collapsing them.
 *
 * The two date boxes only appear on Custom, and choosing it seeds them with
 * whatever the previous preset resolved to. That keeps the original trick —
 * the admin picks QTD, switches to Custom, and finds the quarter's dates
 * already filled in to nudge — without the boxes sitting there restating a
 * range they can't edit the rest of the time.
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

/** A preset's own dates, as `YYYY-MM-DD` for the two date inputs. */
function presetDates(preset: Exclude<ReportFilterState['preset'], 'CUSTOM'>) {
  // Resolved in the browser purely to populate the two date boxes; the server
  // resolves the preset again for the actual query, so a stale clock here shows
  // a slightly-off placeholder rather than reporting on the wrong period.
  const range = resolvePreset(preset)
  return {
    from: dayKey(range.start),
    // `end` is exclusive, so step back a day to show the last day covered.
    to: dayKey(new Date(range.end.getTime() - 86_400_000)),
  }
}

function selectPreset(preset: ReportFilterState['preset']) {
  if (preset === 'CUSTOM') {
    // The boxes are about to become visible and editable, so they must hold
    // something. They normally already do, but a `?preset=CUSTOM` URL with no
    // dates on it arrives here empty — fall back to a month to date.
    const seeded = props.modelValue.from && props.modelValue.to
      ? { from: props.modelValue.from, to: props.modelValue.to }
      : presetDates('MTD')
    update({ preset, ...seeded })
    return
  }

  update({ preset, ...presetDates(preset) })
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
    <div class="flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">Date range</span>
        <select
          :value="modelValue.preset"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-1.5"
          @change="selectPreset(($event.target as HTMLSelectElement).value as ReportFilterState['preset'])"
        >
          <option
            v-for="preset in RANGE_PRESETS"
            :key="preset.id"
            :value="preset.id"
          >
            {{ preset.label }}
          </option>
        </select>
      </label>

      <template v-if="modelValue.preset === 'CUSTOM'">
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
      </template>

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
