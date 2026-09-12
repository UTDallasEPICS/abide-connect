<script setup lang="ts">
import type { YearOverYearPoint } from '#shared/types/reports'
import {
  axisTicks,
  columnPath,
  formatCompact,
  labelStride,
  niceMax,
  scaleY,
  shouldLabel,
} from '~/lib/chart'

/**
 * This period's monthly hours against the same months a year earlier.
 *
 * Deliberately an emphasis chart rather than two equal categorical series:
 * last year is context, this year is the subject, so last year is a grey
 * reference marker and this year is the column in the accent hue. Two bright
 * colours here would make the reader work out which one they're being asked to
 * look at on a page whose whole job is handing them one number.
 *
 * Last year is a *line across the column*, not a bar behind it. A backdrop bar
 * disappears completely in every month where this year is higher — which is the
 * good news, and exactly the month a reader most wants the comparison for. The
 * marker reads the same whichever way the year went.
 */

const props = defineProps<{ points: YearOverYearPoint[] }>()

const container = ref<HTMLElement | null>(null)
const width = useElementWidth(container)

const PAD = { left: 42, right: 12, top: 12, bottom: 24 }
const PLOT_HEIGHT = 170
const height = PAD.top + PLOT_HEIGHT + PAD.bottom
const MAX_BAR = 24

const maxHours = computed(() =>
  niceMax(Math.max(...props.points.flatMap(point => [point.hours, point.priorHours]), 0)),
)
const yTicks = computed(() => axisTicks(maxHours.value, 4))

const plotWidth = computed(() => Math.max(80, width.value - PAD.left - PAD.right))
const bandWidth = computed(() => plotWidth.value / Math.max(1, props.points.length))
const barWidth = computed(() => Math.min(MAX_BAR, Math.max(6, bandWidth.value - 14)))
/** The prior-year marker overhangs the column slightly so it stays readable. */
const markerWidth = computed(() => barWidth.value + 10)
const stride = computed(() => labelStride(props.points.length, Math.max(3, Math.floor(width.value / 52))))

function bandCentre(index: number): number {
  return PAD.left + bandWidth.value * (index + 0.5)
}

const hoveredIndex = ref<number | null>(null)
const hovered = computed(() =>
  hoveredIndex.value === null ? null : props.points[hoveredIndex.value] ?? null,
)

function changeFor(point: YearOverYearPoint): string {
  if (point.priorHours <= 0) return 'no hours a year earlier'
  const change = ((point.hours - point.priorHours) / point.priorHours) * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(0)}% vs last year`
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300">
        <span
          class="w-2.5 h-2.5 rounded-sm"
          style="background: var(--viz-series-1)"
        />
        This period
      </span>
      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300">
        <span
          class="w-3.5 h-[2px] rounded-full"
          style="background: var(--viz-muted-mark)"
        />
        Same months last year
      </span>
    </div>

    <div
      ref="container"
      class="relative w-full min-w-0 overflow-hidden"
    >
      <svg
        :width="width"
        :height="height"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        class="block max-w-full"
        aria-label="Monthly volunteer hours compared with the same months a year earlier"
      >
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick}`"
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="scaleY(tick, maxHours, PAD.top, PLOT_HEIGHT)"
          :y2="scaleY(tick, maxHours, PAD.top, PLOT_HEIGHT)"
          stroke="var(--viz-grid)"
          stroke-width="1"
        />
        <text
          v-for="tick in yTicks"
          :key="`ytick-${tick}`"
          :x="PAD.left - 8"
          :y="scaleY(tick, maxHours, PAD.top, PLOT_HEIGHT) + 3"
          text-anchor="end"
          font-size="10"
          fill="var(--viz-ink-muted)"
          style="font-variant-numeric: tabular-nums"
        >{{ formatCompact(tick) }}</text>

        <g
          v-for="(point, index) in points"
          :key="point.key"
        >
          <rect
            :x="PAD.left + bandWidth * index"
            :y="PAD.top"
            :width="bandWidth"
            :height="PLOT_HEIGHT"
            fill="transparent"
            @pointerenter="hoveredIndex = index"
            @pointerleave="hoveredIndex = null"
          />
          <path
            :d="columnPath(
              bandCentre(index) - barWidth / 2,
              scaleY(point.hours, maxHours, PAD.top, PLOT_HEIGHT),
              barWidth,
              PAD.top + PLOT_HEIGHT - scaleY(point.hours, maxHours, PAD.top, PLOT_HEIGHT),
            )"
            fill="var(--viz-series-1)"
            :fill-opacity="hoveredIndex === null || hoveredIndex === index ? 1 : 0.55"
            class="pointer-events-none"
          />
          <!-- Prior year, on top of the column so it reads in either direction.
               A month with no hours a year earlier gets no marker at all,
               rather than one sitting on the baseline pretending to be data. -->
          <line
            v-if="point.priorHours > 0"
            :x1="bandCentre(index) - markerWidth / 2"
            :x2="bandCentre(index) + markerWidth / 2"
            :y1="scaleY(point.priorHours, maxHours, PAD.top, PLOT_HEIGHT)"
            :y2="scaleY(point.priorHours, maxHours, PAD.top, PLOT_HEIGHT)"
            stroke="var(--viz-muted-mark)"
            stroke-width="2"
            stroke-linecap="round"
            class="pointer-events-none"
          />
        </g>

        <line
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="PAD.top + PLOT_HEIGHT"
          :y2="PAD.top + PLOT_HEIGHT"
          stroke="var(--viz-axis)"
          stroke-width="1"
        />

        <text
          v-for="(point, index) in points"
          v-show="shouldLabel(index, points.length, stride)"
          :key="`x-${point.key}`"
          :x="bandCentre(index)"
          :y="PAD.top + PLOT_HEIGHT + 15"
          text-anchor="middle"
          font-size="10"
          fill="var(--viz-ink-muted)"
        >{{ point.label }}</text>
      </svg>

      <div
        v-if="hovered"
        class="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-xs whitespace-nowrap"
      >
        <p class="font-bold text-slate-900 dark:text-white mb-1">
          {{ hovered.label }}
        </p>
        <p class="text-slate-700 dark:text-gray-300">
          <span class="font-semibold tabular-nums">{{ hovered.hours.toLocaleString() }}</span> hrs
          <span class="text-slate-500 dark:text-gray-400">
            · {{ hovered.priorHours.toLocaleString() }} hrs a year earlier
          </span>
        </p>
        <p class="text-slate-500 dark:text-gray-400">
          {{ changeFor(hovered) }}
        </p>
      </div>
    </div>
  </div>
</template>
