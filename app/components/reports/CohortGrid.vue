<script setup lang="ts">
import type { RetentionReport } from '#shared/types/reports'
import { rampIndex } from '~/lib/chart'

/**
 * Retention by signup cohort: one row per signup month, one column per month
 * since signup, each cell the share of that cohort still logging hours.
 *
 * A real table with real headers rather than a drawn grid — the numbers are the
 * content here, the shading only helps the eye find the cliff, and a `<table>`
 * is what lets a screen reader read "March cohort, month 3, 42%".
 *
 * Cells past the present are blank, not zero. A cohort that signed up last
 * month has no month-3 number yet, and printing 0% there would read as total
 * churn — the most misleading thing this chart could do.
 */

const props = defineProps<{ retention: RetentionReport }>()

const RAMP = [
  'var(--viz-seq-0)',
  'var(--viz-seq-1)',
  'var(--viz-seq-2)',
  'var(--viz-seq-3)',
  'var(--viz-seq-4)',
  'var(--viz-seq-5)',
  'var(--viz-seq-6)',
]

function background(value: number | null): string {
  if (value === null) return 'transparent'
  return RAMP[rampIndex(value, 100, RAMP.length)] ?? RAMP[0]!
}

/** Paired to the ramp step in CSS — see the note in `CoverageHeatmap.vue`. */
function ink(value: number | null): string {
  if (value === null) return 'var(--viz-ink-muted)'
  return `var(--viz-seq-ink-${rampIndex(value, 100, RAMP.length)})`
}

/** Average retention per column, so the reader can see where the cliff is. */
const columnAverages = computed(() =>
  props.retention.columns.map((_, index) => {
    const values = props.retention.rows
      .map(row => row.values[index])
      .filter((value): value is number => value !== null && value !== undefined)

    return values.length === 0
      ? null
      : Math.round(values.reduce((total, value) => total + value, 0) / values.length)
  }),
)
</script>

<template>
  <div class="overflow-x-auto">
    <table
      v-if="retention.rows.length"
      class="w-full min-w-[520px] border-separate"
      style="border-spacing: 2px"
    >
      <caption class="sr-only">
        Percentage of each signup cohort still logging volunteer hours, by months since signup
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="text-left text-[11px] font-semibold text-slate-600 dark:text-gray-400 px-1 pb-1"
          >
            Signed up
          </th>
          <th
            scope="col"
            class="text-left text-[11px] font-semibold text-slate-600 dark:text-gray-400 px-1 pb-1"
          >
            Size
          </th>
          <th
            v-for="column in retention.columns"
            :key="column"
            scope="col"
            class="text-center text-[11px] font-semibold text-slate-600 dark:text-gray-400 px-1 pb-1"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in retention.rows"
          :key="row.cohort"
        >
          <th
            scope="row"
            class="text-left text-xs font-semibold text-slate-700 dark:text-gray-300 whitespace-nowrap px-1"
          >
            {{ row.label }}
          </th>
          <td class="text-xs font-medium text-slate-500 dark:text-gray-400 tabular-nums px-1">
            {{ row.size }}
          </td>
          <td
            v-for="(value, index) in row.values"
            :key="index"
            class="text-center text-[11px] font-bold tabular-nums rounded-md h-8 min-w-[38px]"
            :style="{ background: background(value), color: ink(value) }"
          >
            {{ value === null ? '·' : `${value}%` }}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th
            scope="row"
            colspan="2"
            class="text-left text-[11px] font-semibold text-slate-600 dark:text-gray-400 px-1 pt-1"
          >
            Cohort average
          </th>
          <td
            v-for="(average, index) in columnAverages"
            :key="index"
            class="text-center text-[11px] font-semibold text-slate-600 dark:text-gray-400 tabular-nums pt-1"
          >
            {{ average === null ? '·' : `${average}%` }}
          </td>
        </tr>
      </tfoot>
    </table>

    <p
      v-else
      class="text-sm font-medium text-slate-500 dark:text-gray-400 py-6 text-center"
    >
      No volunteers signed up inside this period, so there are no cohorts to follow yet.
      Widen the range to see retention.
    </p>
  </div>
</template>
