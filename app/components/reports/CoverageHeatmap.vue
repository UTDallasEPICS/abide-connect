<script setup lang="ts">
import type { CoverageReport } from '#shared/types/reports'
import { rampIndex } from '~/lib/chart'

/**
 * Day of week × time of day, shaded by volunteer hours actually covered.
 *
 * Built as a CSS grid rather than SVG: it is a table of 28 cells that has to
 * reflow on a phone, and letting the browser lay it out means the cells stay
 * square-ish at any width and each one can be a real focusable element instead
 * of a `<rect>` with a hand-rolled hit target.
 *
 * The ramp is one hue, light to dark, and an empty cell gets the dedicated
 * "nothing" step — on a coverage grid the difference between no shift and a
 * thin shift is the entire point, and a continuous scale would blur them.
 */

const props = defineProps<{ coverage: CoverageReport }>()

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const RAMP = [
  'var(--viz-seq-0)',
  'var(--viz-seq-1)',
  'var(--viz-seq-2)',
  'var(--viz-seq-3)',
  'var(--viz-seq-4)',
  'var(--viz-seq-5)',
  'var(--viz-seq-6)',
]

const cellsByKey = computed(() => {
  const map = new Map<string, CoverageReport['cells'][number]>()
  for (const cell of props.coverage.cells) map.set(`${cell.weekday}:${cell.band}`, cell)
  return map
})

function cellFor(weekday: number, band: string) {
  return cellsByKey.value.get(`${weekday}:${band}`)
}

function fillFor(hours: number): string {
  return RAMP[rampIndex(hours, props.coverage.maxFilledHours, RAMP.length)] ?? RAMP[0]!
}

/**
 * Ink is paired to the ramp step in CSS rather than decided here. The ramp runs
 * light-to-dark on a white surface and dark-to-light on the dark one, so "the
 * high steps get white text" is right in one mode and unreadable in the other.
 */
function inkFor(hours: number): string {
  return `var(--viz-seq-ink-${rampIndex(hours, props.coverage.maxFilledHours, RAMP.length)})`
}

/**
 * Whole hours, except below one — a half-hour cell rounded to "0" reads as an
 * empty slot while sitting on a coloured tile, which is the one thing this grid
 * must never say.
 */
function cellLabel(hours: number): string {
  if (hours <= 0) return ''
  return hours < 1 ? '<1' : String(Math.round(hours))
}

function describe(weekday: number, band: string): string {
  const cell = cellFor(weekday, band)
  if (!cell) return ''

  const bandLabel = props.coverage.bands.find(b => b.id === band)?.label ?? band
  const covered = `${WEEKDAYS[weekday]} ${bandLabel.toLowerCase()}: ${cell.filledHours} hours covered`

  return cell.neededHours > 0
    ? `${covered} of ${cell.neededHours} scheduled (${Math.round((cell.fillRate ?? 0) * 100)}% filled)`
    : `${covered}; no shift capacity was published`
}

const worstGapLabel = computed(() => {
  const gap = props.coverage.worstGap
  if (!gap) return null

  const bandLabel = props.coverage.bands.find(b => b.id === gap.band)?.label ?? gap.band
  return `${WEEKDAYS[gap.weekday]} ${bandLabel.toLowerCase()} is the thinnest slot — `
    + `${Math.round(gap.fillRate * 100)}% of published shifts filled, `
    + `${gap.shortfallHours} hours short.`
})
</script>

<template>
  <div>
    <div
      v-if="worstGapLabel"
      class="flex items-start gap-2 mb-3 rounded-lg bg-slate-50 dark:bg-gray-900 px-3 py-2"
    >
      <UIcon
        name="i-lucide-alert-triangle"
        class="w-4 h-4 mt-0.5 shrink-0 text-[var(--viz-critical)]"
      />
      <p class="text-xs font-medium text-slate-700 dark:text-gray-300">
        {{ worstGapLabel }}
      </p>
    </div>

    <div class="overflow-x-auto">
      <div class="min-w-[380px]">
        <!-- Column headers -->
        <div
          class="grid gap-0.5 mb-0.5"
          style="grid-template-columns: 76px repeat(7, minmax(0, 1fr))"
        >
          <div />
          <div
            v-for="day in WEEKDAYS"
            :key="day"
            class="text-center text-[11px] font-semibold text-slate-600 dark:text-gray-400"
          >
            {{ day }}
          </div>
        </div>

        <div
          v-for="band in coverage.bands"
          :key="band.id"
          class="grid gap-0.5 mb-0.5"
          style="grid-template-columns: 76px repeat(7, minmax(0, 1fr))"
        >
          <div class="flex flex-col justify-center pr-2">
            <span class="text-[11px] font-semibold text-slate-700 dark:text-gray-300 leading-tight">
              {{ band.label }}
            </span>
            <span class="text-[10px] font-medium text-slate-400 dark:text-gray-500 leading-tight">
              {{ band.fromHour % 12 || 12 }}{{ band.fromHour < 12 ? 'a' : 'p' }}–{{ band.toHour % 12 || 12 }}{{ band.toHour < 12 ? 'a' : 'p' }}
            </span>
          </div>

          <div
            v-for="(day, weekday) in WEEKDAYS"
            :key="`${band.id}-${day}`"
            class="rounded-md h-11 flex items-center justify-center cursor-default transition-transform hover:scale-[1.06]"
            :style="{ background: fillFor(cellFor(weekday, band.id)?.filledHours ?? 0) }"
            :title="describe(weekday, band.id)"
            tabindex="0"
            role="img"
            :aria-label="describe(weekday, band.id)"
          >
            <span
              v-if="(cellFor(weekday, band.id)?.filledHours ?? 0) > 0"
              class="text-[11px] font-bold tabular-nums"
              :style="{ color: inkFor(cellFor(weekday, band.id)?.filledHours ?? 0) }"
            >
              {{ cellLabel(cellFor(weekday, band.id)?.filledHours ?? 0) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Scale legend: mandatory on a continuous colour encoding. -->
    <div class="flex items-center gap-2 mt-3">
      <span class="text-[11px] font-medium text-slate-500 dark:text-gray-400">0 hrs</span>
      <div class="flex gap-0.5">
        <span
          v-for="(step, index) in RAMP"
          :key="index"
          class="w-5 h-3 rounded-sm"
          :style="{ background: step }"
        />
      </div>
      <span class="text-[11px] font-medium text-slate-500 dark:text-gray-400 tabular-nums">
        {{ Math.round(coverage.maxFilledHours) }} hrs
      </span>
    </div>
  </div>
</template>
