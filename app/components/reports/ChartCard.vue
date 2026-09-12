<script setup lang="ts">
/**
 * The frame every chart on the reports pages sits in.
 *
 * It owns the chart/table toggle rather than each chart doing it: a tooltip is
 * not an accessible way to read a value, so every chart here ships a table
 * twin, and having one component enforce it is what stops the fifth chart from
 * quietly shipping without one.
 *
 * `note` is for the caveat that belongs *with* the chart — which statuses were
 * counted, which hours were inferred — kept in the card so it travels with a
 * screenshot of it.
 */

defineProps<{
  title: string
  subtitle?: string
  note?: string
  /** Hides the toggle for panels whose chart already is a table. */
  tableOnly?: boolean
}>()

const showTable = ref(false)

function toggleTable() {
  showTable.value = !showTable.value
}
</script>

<template>
  <!--
    `min-w-0` is load-bearing, not defensive. A grid item defaults to
    `min-width: auto`, so a chart SVG carrying an explicit pixel width stretches
    this card past the viewport instead of the chart measuring the card and
    shrinking — which on a phone clips the right-hand half of every plot.
  -->
  <section
    class="min-w-0 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm"
  >
    <header class="flex items-start justify-between gap-3 mb-4">
      <div class="min-w-0">
        <h2 class="text-base sm:text-lg font-bold text-[#313131] dark:text-white">
          {{ title }}
        </h2>
        <p
          v-if="subtitle"
          class="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400 mt-0.5 text-balance"
        >
          {{ subtitle }}
        </p>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <slot name="actions" />
        <UButton
          v-if="!tableOnly"
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="showTable ? 'i-lucide-chart-column' : 'i-lucide-table'"
          :aria-label="showTable ? 'Show chart' : 'Show data table'"
          :aria-pressed="showTable"
          @click="toggleTable"
        />
      </div>
    </header>

    <div v-show="!showTable || tableOnly">
      <slot />
    </div>

    <!-- Kept mounted rather than v-if'd so the table is in the DOM for
         find-in-page and for a screen reader scanning the card. -->
    <div
      v-show="showTable && !tableOnly"
      class="overflow-x-auto"
    >
      <slot name="table" />
    </div>

    <p
      v-if="note"
      class="mt-3 text-[11px] leading-snug font-medium text-slate-500 dark:text-gray-400"
    >
      {{ note }}
    </p>
  </section>
</template>
