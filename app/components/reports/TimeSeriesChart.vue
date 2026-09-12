<script setup lang="ts">
import type { TimeSeriesPoint } from '#shared/types/reports'
import {
  areaPath,
  axisTicks,
  formatCompact,
  labelStride,
  linePath,
  niceMax,
  scaleY,
  shouldLabel,
} from '~/lib/chart'

/**
 * Hours over time, with volunteer headcount as a second panel beneath it.
 *
 * The headcount is a *panel*, not an overlay on the same axes. Two y-scales on
 * one plot let you slide the scales until any two series look correlated, and
 * the whole reason this chart exists is to judge whether they're diverging —
 * so a chart that can manufacture the answer is worse than no chart. Sharing
 * one x-axis between two stacked plots shows the same divergence and can't lie
 * about its size.
 *
 * The derived hours-per-volunteer figure, which is what "engagement is
 * thinning" actually means, is in the tooltip and the table on every bucket.
 */

const props = withDefaults(defineProps<{
  points: TimeSeriesPoint[]
  showHeadcount?: boolean
}>(), {
  showHeadcount: true,
})

const container = ref<HTMLElement | null>(null)
const width = useElementWidth(container)

const PAD = { left: 44, right: 14, top: 10, bottom: 22 }
const MAIN_HEIGHT = 168
const SUB_HEIGHT = 64
const SUB_GAP = 26

const plotWidth = computed(() => Math.max(120, width.value - PAD.left - PAD.right))
const subTop = computed(() => PAD.top + MAIN_HEIGHT + SUB_GAP)
const height = computed(() =>
  PAD.top + MAIN_HEIGHT + PAD.bottom
  + (props.showHeadcount ? SUB_GAP + SUB_HEIGHT + PAD.bottom : 0),
)

const hoursMax = computed(() => niceMax(Math.max(...props.points.map(p => p.hours), 0)))
const volunteerMax = computed(() => niceMax(Math.max(...props.points.map(p => p.volunteers), 0)))

/** Single-bucket ranges centre their one point instead of pinning it left. */
function xFor(index: number): number {
  if (props.points.length <= 1) return PAD.left + plotWidth.value / 2
  return PAD.left + (plotWidth.value / (props.points.length - 1)) * index
}

const hoursPoints = computed(() =>
  props.points.map((point, index) => ({
    x: xFor(index),
    y: scaleY(point.hours, hoursMax.value, PAD.top, MAIN_HEIGHT),
  })),
)

const volunteerPoints = computed(() =>
  props.points.map((point, index) => ({
    x: xFor(index),
    y: scaleY(point.volunteers, volunteerMax.value, subTop.value, SUB_HEIGHT),
  })),
)

const baseline = PAD.top + MAIN_HEIGHT
const yTicks = computed(() => axisTicks(hoursMax.value, 4))
const stride = computed(() => labelStride(props.points.length, Math.max(3, Math.floor(width.value / 74))))

/**
 * The first and last points sit on the plot edges, so centring their labels
 * pushes half the text outside the SVG and it gets clipped mid-word. Anchoring
 * the extremes inward keeps them whole.
 */
function labelAnchor(index: number): 'start' | 'middle' | 'end' {
  if (index === 0) return 'start'
  if (index === props.points.length - 1) return 'end'
  return 'middle'
}

/* ------------------------------------------------------------- interaction */

const hoveredIndex = ref<number | null>(null)

function indexFromPointer(clientX: number) {
  const bounds = container.value?.getBoundingClientRect()
  if (!bounds || props.points.length === 0) return null

  const offset = clientX - bounds.left - PAD.left
  const step = props.points.length <= 1 ? plotWidth.value : plotWidth.value / (props.points.length - 1)
  const index = Math.round(offset / step)

  return Math.min(props.points.length - 1, Math.max(0, index))
}

function onPointerMove(pointerEvent: PointerEvent) {
  hoveredIndex.value = indexFromPointer(pointerEvent.clientX)
}

// Arrow keys walk the series so the values are reachable without a pointer —
// the tooltip is an enhancement, never the only way to read a number.
function onKeydown(keyEvent: KeyboardEvent) {
  if (props.points.length === 0) return

  const current = hoveredIndex.value ?? props.points.length - 1
  if (keyEvent.key === 'ArrowRight') {
    hoveredIndex.value = Math.min(props.points.length - 1, current + 1)
  }
  else if (keyEvent.key === 'ArrowLeft') {
    hoveredIndex.value = Math.max(0, current - 1)
  }
  else if (keyEvent.key === 'Escape') {
    hoveredIndex.value = null
    return
  }
  else {
    return
  }
  keyEvent.preventDefault()
}

const hovered = computed(() =>
  hoveredIndex.value === null ? null : props.points[hoveredIndex.value] ?? null,
)

/** Flips the tooltip to the left of the crosshair near the right-hand edge. */
const tooltipStyle = computed(() => {
  if (hoveredIndex.value === null) return {}
  const x = xFor(hoveredIndex.value)
  const flip = x > width.value - 150
  return {
    left: `${flip ? x - 12 : x + 12}px`,
    transform: flip ? 'translateX(-100%)' : undefined,
  }
})

const lastPoint = computed(() => props.points[props.points.length - 1] ?? null)
</script>

<template>
  <div>
    <!-- Two series, so a legend is always present; the panel headings double
         as the direct labels, since each panel holds exactly one line. -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
      <span class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300">
        <span
          class="w-3 h-[2px] rounded-full"
          style="background: var(--viz-series-1)"
        />
        Hours logged
      </span>
      <span
        v-if="showHeadcount"
        class="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300"
      >
        <span
          class="w-3 h-[2px] rounded-full"
          style="background: var(--viz-series-2)"
        />
        Volunteers active
      </span>
    </div>

    <div
      ref="container"
      class="relative w-full min-w-0 overflow-hidden"
      @pointermove="onPointerMove"
      @pointerleave="hoveredIndex = null"
    >
      <svg
        :width="width"
        :height="height"
        :viewBox="`0 0 ${width} ${height}`"
        role="img"
        tabindex="0"
        class="block max-w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        :aria-label="`Volunteer hours over ${points.length} periods.`"
        @keydown="onKeydown"
      >
        <!-- Gridlines: solid hairlines one step off the surface, never dashed. -->
        <g>
          <line
            v-for="tick in yTicks"
            :key="`grid-${tick}`"
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="scaleY(tick, hoursMax, PAD.top, MAIN_HEIGHT)"
            :y2="scaleY(tick, hoursMax, PAD.top, MAIN_HEIGHT)"
            stroke="var(--viz-grid)"
            stroke-width="1"
          />
          <text
            v-for="tick in yTicks"
            :key="`ytick-${tick}`"
            :x="PAD.left - 8"
            :y="scaleY(tick, hoursMax, PAD.top, MAIN_HEIGHT) + 3"
            text-anchor="end"
            font-size="10"
            fill="var(--viz-ink-muted)"
            style="font-variant-numeric: tabular-nums"
          >{{ formatCompact(tick) }}</text>
        </g>

        <!-- Hours: a 10% wash under a 2px line, one hue, no gradient. -->
        <path
          :d="areaPath(hoursPoints, baseline)"
          fill="var(--viz-series-1)"
          fill-opacity="0.1"
        />
        <path
          :d="linePath(hoursPoints)"
          fill="none"
          stroke="var(--viz-series-1)"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- One direct label, on the endpoint: the value a reader looks for
             first, and the only one that can be placed without collisions. -->
        <template v-if="lastPoint && hoursPoints.length">
          <circle
            :cx="hoursPoints[hoursPoints.length - 1]!.x"
            :cy="hoursPoints[hoursPoints.length - 1]!.y"
            r="4"
            fill="var(--viz-series-1)"
            stroke="var(--viz-surface)"
            stroke-width="2"
          />
          <!-- The exact value, not the axis's compacted form: an axis tick may
               round 12.5 to 13, but a label pinned to a data point must agree
               with the tooltip and the table. -->
          <text
            :x="hoursPoints[hoursPoints.length - 1]!.x - 9"
            :y="hoursPoints[hoursPoints.length - 1]!.y - 10"
            text-anchor="end"
            font-size="11"
            font-weight="700"
            fill="var(--viz-ink)"
          >{{ lastPoint.hours.toLocaleString() }}</text>
        </template>

        <line
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="baseline"
          :y2="baseline"
          stroke="var(--viz-axis)"
          stroke-width="1"
        />

        <!-- Headcount, its own plot on the shared x-axis. -->
        <template v-if="showHeadcount">
          <text
            :x="PAD.left"
            :y="subTop - 10"
            font-size="10"
            font-weight="600"
            fill="var(--viz-ink-secondary)"
          >Volunteers active</text>
          <text
            :x="PAD.left - 8"
            :y="subTop + 4"
            text-anchor="end"
            font-size="10"
            fill="var(--viz-ink-muted)"
            style="font-variant-numeric: tabular-nums"
          >{{ formatCompact(volunteerMax) }}</text>
          <text
            :x="PAD.left - 8"
            :y="subTop + SUB_HEIGHT + 3"
            text-anchor="end"
            font-size="10"
            fill="var(--viz-ink-muted)"
          >0</text>

          <path
            :d="linePath(volunteerPoints)"
            fill="none"
            stroke="var(--viz-series-2)"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <circle
            v-if="volunteerPoints.length"
            :cx="volunteerPoints[volunteerPoints.length - 1]!.x"
            :cy="volunteerPoints[volunteerPoints.length - 1]!.y"
            r="4"
            fill="var(--viz-series-2)"
            stroke="var(--viz-surface)"
            stroke-width="2"
          />
          <line
            :x1="PAD.left"
            :x2="width - PAD.right"
            :y1="subTop + SUB_HEIGHT"
            :y2="subTop + SUB_HEIGHT"
            stroke="var(--viz-axis)"
            stroke-width="1"
          />
        </template>

        <!-- X labels, thinned to fit and anchored on the most recent bucket. -->
        <g>
          <text
            v-for="(point, index) in points"
            v-show="shouldLabel(index, points.length, stride)"
            :key="`x-${point.key}`"
            :x="xFor(index)"
            :y="(showHeadcount ? subTop + SUB_HEIGHT : baseline) + 15"
            :text-anchor="labelAnchor(index)"
            font-size="10"
            fill="var(--viz-ink-muted)"
          >{{ point.label }}</text>
        </g>

        <!-- Crosshair. Drawn last so it sits above the marks. -->
        <g v-if="hoveredIndex !== null">
          <line
            :x1="xFor(hoveredIndex)"
            :x2="xFor(hoveredIndex)"
            :y1="PAD.top"
            :y2="showHeadcount ? subTop + SUB_HEIGHT : baseline"
            stroke="var(--viz-ink-muted)"
            stroke-width="1"
          />
          <circle
            :cx="hoursPoints[hoveredIndex]!.x"
            :cy="hoursPoints[hoveredIndex]!.y"
            r="4.5"
            fill="var(--viz-series-1)"
            stroke="var(--viz-surface)"
            stroke-width="2"
          />
          <circle
            v-if="showHeadcount"
            :cx="volunteerPoints[hoveredIndex]!.x"
            :cy="volunteerPoints[hoveredIndex]!.y"
            r="4.5"
            fill="var(--viz-series-2)"
            stroke="var(--viz-surface)"
            stroke-width="2"
          />
        </g>
      </svg>

      <div
        v-if="hovered"
        class="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg text-xs"
        :style="tooltipStyle"
      >
        <p class="font-bold text-slate-900 dark:text-white mb-1 whitespace-nowrap">
          {{ hovered.label }}
        </p>
        <p class="flex items-center gap-2 text-slate-700 dark:text-gray-300 whitespace-nowrap">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style="background: var(--viz-series-1)"
          />
          <span class="font-semibold tabular-nums">{{ hovered.hours.toLocaleString() }}</span> hours
        </p>
        <p class="flex items-center gap-2 text-slate-700 dark:text-gray-300 whitespace-nowrap">
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style="background: var(--viz-series-2)"
          />
          <span class="font-semibold tabular-nums">{{ hovered.volunteers }}</span> volunteers
        </p>
        <p class="mt-1 pt-1 border-t border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 whitespace-nowrap">
          <span class="font-semibold tabular-nums">{{ hovered.hoursPerVolunteer }}</span> hrs per volunteer
        </p>
      </div>
    </div>
  </div>
</template>
