<script setup lang="ts">
import type { DistributionReport } from '#shared/types/reports'
import { axisTicks, columnPath, formatCompact, niceMax, scaleY } from '~/lib/chart'

/**
 * Hours per volunteer, as a histogram.
 *
 * Mean and median are both marked, because on this shape they always disagree:
 * a handful of people carrying most of the hours drags the mean well above what
 * a typical volunteer actually does, and a report quoting only the mean
 * overstates the median volunteer's commitment to everyone who reads it.
 *
 * They're marked as carets under the bin each one falls in, not as vertical
 * rules at an x position — the bins are unequal in width (0–5 next to 80–160),
 * so there is no honest linear x to place a rule on.
 */

const props = defineProps<{ distribution: DistributionReport }>()

const container = ref<HTMLElement | null>(null)
const width = useElementWidth(container)

const PAD = { left: 38, right: 12, top: 12, bottom: 40 }
const PLOT_HEIGHT = 150
const height = PAD.top + PLOT_HEIGHT + PAD.bottom
/** Never a full-width block: the leftover band is the breathing room. */
const MAX_BAR = 24
const GAP = 2

const bins = computed(() => props.distribution.bins)
const maxCount = computed(() => niceMax(Math.max(...bins.value.map(bin => bin.volunteers), 0)))
// Integer ticks: the y-axis here counts volunteers, and "3.3 volunteers" is not
// a thing anyone can be.
const yTicks = computed(() => axisTicks(maxCount.value, 4, true))

const plotWidth = computed(() => Math.max(80, width.value - PAD.left - PAD.right))
const bandWidth = computed(() => plotWidth.value / Math.max(1, bins.value.length))
const barWidth = computed(() => Math.min(MAX_BAR, Math.max(6, bandWidth.value - GAP * 2 - 8)))

function bandCentre(index: number): number {
  return PAD.left + bandWidth.value * (index + 0.5)
}

/** Which bin a raw hours figure lands in, for the mean/median carets. */
function binIndexFor(hours: number): number {
  const index = bins.value.findIndex(bin =>
    hours >= bin.from && (bin.to === null || hours < bin.to),
  )
  return index === -1 ? bins.value.length - 1 : index
}

const meanIndex = computed(() => binIndexFor(props.distribution.mean))
const medianIndex = computed(() => binIndexFor(props.distribution.median))

const hoveredIndex = ref<number | null>(null)
const hovered = computed(() =>
  hoveredIndex.value === null ? null : bins.value[hoveredIndex.value] ?? null,
)
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-x-5 gap-y-1 mb-3">
      <span class="text-xs font-semibold text-slate-700 dark:text-gray-300">
        Median <span class="tabular-nums text-slate-900 dark:text-white">{{ distribution.median }}</span> hrs
      </span>
      <span class="text-xs font-semibold text-slate-700 dark:text-gray-300">
        Mean <span class="tabular-nums text-slate-900 dark:text-white">{{ distribution.mean }}</span> hrs
      </span>
      <span class="text-xs font-semibold text-slate-700 dark:text-gray-300">
        Busiest <span class="tabular-nums text-slate-900 dark:text-white">{{ distribution.max }}</span> hrs
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
        aria-label="Distribution of hours logged per volunteer"
      >
        <line
          v-for="tick in yTicks"
          :key="`grid-${tick}`"
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="scaleY(tick, maxCount, PAD.top, PLOT_HEIGHT)"
          :y2="scaleY(tick, maxCount, PAD.top, PLOT_HEIGHT)"
          stroke="var(--viz-grid)"
          stroke-width="1"
        />
        <text
          v-for="tick in yTicks"
          :key="`ytick-${tick}`"
          :x="PAD.left - 8"
          :y="scaleY(tick, maxCount, PAD.top, PLOT_HEIGHT) + 3"
          text-anchor="end"
          font-size="10"
          fill="var(--viz-ink-muted)"
          style="font-variant-numeric: tabular-nums"
        >{{ formatCompact(tick) }}</text>

        <g
          v-for="(bin, index) in bins"
          :key="bin.label"
        >
          <!-- Hit target spans the whole band, not just the bar: a 6px-tall
               column is impossible to land on otherwise. -->
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
              scaleY(bin.volunteers, maxCount, PAD.top, PLOT_HEIGHT),
              barWidth,
              PAD.top + PLOT_HEIGHT - scaleY(bin.volunteers, maxCount, PAD.top, PLOT_HEIGHT),
            )"
            fill="var(--viz-series-1)"
            :fill-opacity="hoveredIndex === null || hoveredIndex === index ? 1 : 0.55"
            class="pointer-events-none"
          />
          <text
            v-if="bin.volunteers > 0"
            :x="bandCentre(index)"
            :y="scaleY(bin.volunteers, maxCount, PAD.top, PLOT_HEIGHT) - 5"
            text-anchor="middle"
            font-size="10"
            font-weight="700"
            fill="var(--viz-ink)"
            class="pointer-events-none"
          >{{ bin.volunteers }}</text>
          <text
            :x="bandCentre(index)"
            :y="PAD.top + PLOT_HEIGHT + 14"
            text-anchor="middle"
            font-size="10"
            fill="var(--viz-ink-muted)"
            class="pointer-events-none"
          >{{ bin.label }}</text>
        </g>

        <line
          :x1="PAD.left"
          :x2="width - PAD.right"
          :y1="PAD.top + PLOT_HEIGHT"
          :y2="PAD.top + PLOT_HEIGHT"
          stroke="var(--viz-axis)"
          stroke-width="1"
        />

        <!-- Median and mean carets. When both land in the same bin they collapse
             to one label rather than being nudged apart: on a phone the two
             nudged labels overlap, and a caret shifted off its bin is worse
             than one that says it covers both. -->
        <g v-if="distribution.totalVolunteers > 0">
          <template v-if="medianIndex === meanIndex">
            <text
              :x="bandCentre(medianIndex)"
              :y="PAD.top + PLOT_HEIGHT + 30"
              text-anchor="middle"
              font-size="9"
              font-weight="700"
              fill="var(--viz-ink-secondary)"
            >▲ median &amp; mean</text>
          </template>
          <template v-else>
            <text
              :x="bandCentre(medianIndex)"
              :y="PAD.top + PLOT_HEIGHT + 30"
              text-anchor="middle"
              font-size="9"
              font-weight="700"
              fill="var(--viz-ink-secondary)"
            >▲ median</text>
            <text
              :x="bandCentre(meanIndex)"
              :y="PAD.top + PLOT_HEIGHT + 30"
              text-anchor="middle"
              font-size="9"
              font-weight="700"
              fill="var(--viz-ink-muted)"
            >▲ mean</text>
          </template>
        </g>
      </svg>

      <div
        v-if="hovered"
        class="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 shadow-lg text-xs whitespace-nowrap"
      >
        <span class="font-bold text-slate-900 dark:text-white tabular-nums">{{ hovered.volunteers }}</span>
        <span class="text-slate-600 dark:text-gray-400">
          {{ hovered.volunteers === 1 ? 'volunteer' : 'volunteers' }} logged {{ hovered.label }} hrs
        </span>
      </div>
    </div>
  </div>
</template>
