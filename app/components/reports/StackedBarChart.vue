<script setup lang="ts">
import type { NewVsReturningPoint } from '#shared/types/reports'
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
 * Monthly hours split into first-time and repeat volunteers.
 *
 * Repeat sits on the bottom as the stable base and first-time rides on top, so
 * the answer the chart is read for — is this month's growth recruitment or
 * retention? — is the visible cap rather than something you have to subtract.
 *
 * The two segments are separated by a 2px gap in the surface colour, not by a
 * stroke: an outline around each segment adds ink that isn't data and makes a
 * thin month read as heavier than it is.
 */

const props = defineProps<{ points: NewVsReturningPoint[] }>()

const container = ref<HTMLElement | null>(null)
const width = useElementWidth(container)

const PAD = { left: 40, right: 12, top: 12, bottom: 24 }
const PLOT_HEIGHT = 160
const height = PAD.top + PLOT_HEIGHT + PAD.bottom
const MAX_BAR = 24
const SEGMENT_GAP = 2

const totals = computed(() => props.points.map(point => point.newHours + point.returningHours))
const maxTotal = computed(() => niceMax(Math.max(...totals.value, 0)))
const yTicks = computed(() => axisTicks(maxTotal.value, 4))

const plotWidth = computed(() => Math.max(80, width.value - PAD.left - PAD.right))
const bandWidth = computed(() => plotWidth.value / Math.max(1, props.points.length))
const barWidth = computed(() => Math.min(MAX_BAR, Math.max(5, bandWidth.value - 8)))
const stride = computed(() => labelStride(props.points.length, Math.max(3, Math.floor(width.value / 52))))

function bandCentre(index: number): number {
  return PAD.left + bandWidth.value * (index + 0.5)
}

const bars = computed(() => props.points.map((point, index) => {
  const x = bandCentre(index) - barWidth.value / 2
  const baseline = PAD.top + PLOT_HEIGHT

  const returningTop = scaleY(point.returningHours, maxTotal.value, PAD.top, PLOT_HEIGHT)
  const stackTop = scaleY(point.returningHours + point.newHours, maxTotal.value, PAD.top, PLOT_HEIGHT)

  // Only the topmost segment present gets rounded corners; the one underneath
  // it stays square so the two read as one column split in two.
  const hasNew = point.newHours > 0
  const returningHeight = baseline - returningTop
  const newHeight = returningTop - stackTop - (hasNew && returningHeight > 0 ? SEGMENT_GAP : 0)

  return {
    key: point.key,
    x,
    point,
    returning: returningHeight > 0
      ? {
          d: hasNew
            ? `M${x},${returningTop} h${barWidth.value} v${returningHeight} h${-barWidth.value} Z`
            : columnPath(x, returningTop, barWidth.value, returningHeight),
        }
      : null,
    new: newHeight > 0
      ? { d: columnPath(x, stackTop, barWidth.value, newHeight) }
      : null,
    index,
  }
}))

const hoveredIndex = ref<number | null>(null)
const hovered = computed(() =>
  hoveredIndex.value === null ? null : props.points[hoveredIndex.value] ?? null,
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300">
        <span
          class="w-2.5 h-2.5 rounded-sm"
          style="background: var(--viz-series-2)"
        />
        First-time volunteers
      </span>
      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300">
        <span
          class="w-2.5 h-2.5 rounded-sm"
          style="background: var(--viz-series-1)"
        />
        Returning volunteers
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
        aria-label="Monthly volunteer hours split between first-time and returning volunteers"
      >
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick}`"
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="scaleY(tick, maxTotal, PAD.top, PLOT_HEIGHT)"
          :y2="scaleY(tick, maxTotal, PAD.top, PLOT_HEIGHT)"
          stroke="var(--viz-grid)"
          stroke-width="1"
        />
        <text
          v-for="tick in yTicks"
          :key="`ytick-${tick}`"
          :x="PAD.left - 8"
          :y="scaleY(tick, maxTotal, PAD.top, PLOT_HEIGHT) + 3"
          text-anchor="end"
          font-size="10"
          fill="var(--viz-ink-muted)"
          style="font-variant-numeric: tabular-nums"
        >{{ formatCompact(tick) }}</text>

        <g
          v-for="bar in bars"
          :key="bar.key"
        >
          <rect
            :x="PAD.left + bandWidth * bar.index"
            :y="PAD.top"
            :width="bandWidth"
            :height="PLOT_HEIGHT"
            fill="transparent"
            @pointerenter="hoveredIndex = bar.index"
            @pointerleave="hoveredIndex = null"
          />
          <path
            v-if="bar.returning"
            :d="bar.returning.d"
            fill="var(--viz-series-1)"
            :fill-opacity="hoveredIndex === null || hoveredIndex === bar.index ? 1 : 0.55"
            class="pointer-events-none"
          />
          <path
            v-if="bar.new"
            :d="bar.new.d"
            fill="var(--viz-series-2)"
            :fill-opacity="hoveredIndex === null || hoveredIndex === bar.index ? 1 : 0.55"
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
        <p class="flex items-center gap-2 text-slate-700 dark:text-gray-300">
          <span
            class="w-2 h-2 rounded-sm shrink-0"
            style="background: var(--viz-series-2)"
          />
          <span class="font-semibold tabular-nums">{{ hovered.newHours }}</span> hrs from
          {{ hovered.newVolunteers }} first-timers
        </p>
        <p class="flex items-center gap-2 text-slate-700 dark:text-gray-300">
          <span
            class="w-2 h-2 rounded-sm shrink-0"
            style="background: var(--viz-series-1)"
          />
          <span class="font-semibold tabular-nums">{{ hovered.returningHours }}</span> hrs from
          {{ hovered.returningVolunteers }} returning
        </p>
      </div>
    </div>
  </div>
</template>
