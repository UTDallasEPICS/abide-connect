<script setup lang="ts">
import { computed } from 'vue'
import {
  formatSlotRange,
  fromDateTimeLocal,
  intervalsOverlap,
  slotColorHex,
  validateTimeSlot,
} from '#shared/utils/timeSlot'

/**
 * A read-only Gantt strip of an event's time blocks, drawn above the editor.
 *
 * The editor is a vertical stack of datetime inputs, which tells you what each
 * block *is* but not what the day *looks like* — an admin can't see a gap at
 * 2pm or three blocks piled on the same hour by reading times off a form. This
 * draws the same rows against the event's own window so coverage is obvious at
 * a glance. It's a mirror of the list below, never an editing surface.
 *
 * Client-only on purpose: the tick labels are wall-clock times, and the server
 * runs in UTC while the admin is in Central, so rendering them server-side then
 * hydrating produces a mismatch. Positions are safe either way (they're ratios
 * of Date differences), but the labels are not — see `#shared/utils/timeSlot`.
 */

interface TimelineSlot {
  id: string | null
  /** `datetime-local` strings, i.e. local wall-clock time. */
  startTime: string
  endTime: string
  capacity: number
  role?: string | null
  note?: string | null
  color?: string | null
  signupCount?: number
}

const props = defineProps<{
  slots: TimelineSlot[]
  /** The event's own window, as `datetime-local` strings. */
  eventStart: string
  eventEnd: string
}>()

/**
 * A block narrower than this is invisible, and a 15-minute shift on an all-day
 * event is legitimately that narrow. Widening it lies about the duration by a
 * pixel or two, which is the right trade against a block you can't see at all.
 */
const MIN_BAR_WIDTH_PERCENT = 1.5

/** Lane height and gap, in px. Kept small — the editor is already crowded. */
const LANE_HEIGHT = 26
const LANE_GAP = 4

const windowStart = computed(() => fromDateTimeLocal(props.eventStart))
const windowEnd = computed(() => fromDateTimeLocal(props.eventEnd))

const windowMs = computed(() =>
  windowEnd.value.getTime() - windowStart.value.getTime(),
)

/**
 * Whether there's a coherent window to draw against. A half-typed datetime
 * parses as `Invalid Date`, and an end before a start gives a negative span —
 * both would divide the layout by garbage, so nothing renders until the admin
 * has entered something real.
 */
const hasWindow = computed(() =>
  !!props.eventStart
  && !!props.eventEnd
  && !Number.isNaN(windowStart.value.getTime())
  && !Number.isNaN(windowEnd.value.getTime())
  && windowMs.value > 0,
)

interface Bar {
  key: string
  /** Percentages of the event window. */
  left: number
  width: number
  lane: number
  label: string
  title: string
  /** The chosen swatch. Ignored while `invalid` — the error colour wins. */
  hex: string
  /** Breaks one of the shared rules, e.g. reaches past the event's end. */
  invalid: boolean
}

/**
 * Blocks laid out into lanes.
 *
 * Overlapping blocks are the whole point of the feature, so they can't share a
 * row. Sorted by start, each block drops into the first lane it doesn't collide
 * with — the standard greedy interval packing — which keeps the strip as short
 * as the schedule allows instead of one row per block.
 */
const bars = computed<Bar[]>(() => {
  if (!hasWindow.value) return []

  const total = windowMs.value
  const startMs = windowStart.value.getTime()
  const endMs = windowEnd.value.getTime()

  const parsed = props.slots
    .map((row, index) => ({
      row,
      index,
      start: fromDateTimeLocal(row.startTime),
      end: fromDateTimeLocal(row.endTime),
    }))
    // A block mid-typing has no meaningful position. The row's own error
    // message in the list below is what tells the admin about it.
    .filter(p =>
      !Number.isNaN(p.start.getTime())
      && !Number.isNaN(p.end.getTime())
      && p.end.getTime() > p.start.getTime(),
    )
    .sort((a, b) =>
      a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime(),
    )

  const lanes: { start: Date, end: Date }[][] = []

  return parsed.map(({ row, index, start, end }) => {
    let lane = lanes.findIndex(occupants =>
      !occupants.some(o => intervalsOverlap(start, end, o.start, o.end)),
    )

    if (lane === -1) {
      lanes.push([])
      lane = lanes.length - 1
    }
    lanes[lane]!.push({ start, end })

    // Drawn clamped to the window so a block reaching past the event's end
    // stays inside the strip. It's still flagged invalid — clamping is a
    // drawing concession, not a correction.
    const drawStart = Math.max(start.getTime(), startMs)
    const drawEnd = Math.min(end.getTime(), endMs)

    // Clamped first, then the width measured against the clamped position: a
    // block sitting entirely outside the window has to stay visible (in red)
    // at the edge of the strip, and measuring against the raw position would
    // give it a negative width and hide the very thing that needs attention.
    const left = Math.min(
      Math.max(((drawStart - startMs) / total) * 100, 0),
      100 - MIN_BAR_WIDTH_PERCENT,
    )
    const width = Math.min(
      Math.max(((drawEnd - drawStart) / total) * 100, MIN_BAR_WIDTH_PERCENT),
      100 - left,
    )

    const range = formatSlotRange(start, end)
    const role = row.role?.trim()
    const spots = `${row.capacity} spot${row.capacity === 1 ? '' : 's'}`

    return {
      key: row.id ?? `new-${index}`,
      left,
      width,
      lane,
      // The role is what an admin is scanning for; the time is already the
      // bar's position, so it only earns space when there's no role.
      label: role || range,
      title: [role, range, spots, row.note?.trim()].filter(Boolean).join(' · '),
      hex: slotColorHex(row.color),
      invalid: validateTimeSlot(
        { id: row.id, startTime: start, endTime: end, capacity: Number(row.capacity), role: row.role },
        { startTime: windowStart.value, endTime: windowEnd.value },
      ) !== null,
    }
  })
})

const laneCount = computed(() =>
  bars.value.reduce((max, bar) => Math.max(max, bar.lane + 1), 0),
)

const stripHeight = computed(() =>
  laneCount.value * LANE_HEIGHT + Math.max(0, laneCount.value - 1) * LANE_GAP,
)

/**
 * Hour marks across the window, at a spacing that won't collide.
 *
 * An 8-hour event wants hourly ticks; a three-day one would draw 72 of them on
 * top of each other, so the step widens with the span. Marks are aligned to the
 * clock rather than to the event's start, so they read as "10 AM", not
 * "2h 37m in".
 */
const ticks = computed(() => {
  if (!hasWindow.value) return []

  const hours = windowMs.value / (1000 * 60 * 60)
  const stepHours = hours <= 8 ? 1 : hours <= 14 ? 2 : hours <= 30 ? 4 : 12
  const multiDay = hours > 24

  const first = new Date(windowStart.value)
  first.setMinutes(0, 0, 0)
  if (first.getTime() < windowStart.value.getTime()) first.setHours(first.getHours() + 1)
  while (first.getHours() % stepHours !== 0) first.setHours(first.getHours() + 1)

  const out: { left: number, label: string }[] = []

  for (
    let t = first.getTime();
    t <= windowEnd.value.getTime();
    t += stepHours * 60 * 60 * 1000
  ) {
    const at = new Date(t)
    out.push({
      left: ((t - windowStart.value.getTime()) / windowMs.value) * 100,
      label: multiDay
        ? at.toLocaleString('en-US', { weekday: 'short', hour: 'numeric' })
        : at.toLocaleTimeString('en-US', { hour: 'numeric' }),
    })
  }

  return out
})
</script>

<template>
  <div
    v-if="hasWindow && bars.length > 0"
    class="rounded-xl border border-gray-200 dark:border-gray-700 px-3 pt-2 pb-3"
  >
    <!-- Axis. Deliberately recessive: it's a reference for the bars, not the
         thing being read. -->
    <div class="relative h-4 mb-1">
      <span
        v-for="tick in ticks"
        :key="tick.left"
        class="absolute top-0 -translate-x-1/2 text-[10px] leading-4 text-gray-400 dark:text-gray-500 whitespace-nowrap"
        :style="{ left: `${tick.left}%` }"
      >
        {{ tick.label }}
      </span>
    </div>

    <div
      class="relative"
      :style="{ height: `${stripHeight}px` }"
    >
      <!-- Gridlines sit under the bars so a bar never looks cut in half. -->
      <div
        v-for="tick in ticks"
        :key="`grid-${tick.left}`"
        class="absolute top-0 bottom-0 w-px bg-gray-100 dark:bg-gray-700/60"
        :style="{ left: `${tick.left}%` }"
      />

      <!-- Each bar carries its own label, so identity never rests on colour
           alone — which also means the strip needs no legend.

           The background is left unset on an invalid block so the error class
           isn't overridden: an inline colour beats a class, and would hide the
           warning behind whatever swatch the admin picked. -->
      <div
        v-for="bar in bars"
        :key="bar.key"
        class="absolute rounded flex items-center px-1.5 ring-2 ring-white dark:ring-gray-800"
        :class="bar.invalid ? 'bg-[#a4123f] dark:bg-[#e11d48]' : ''"
        :style="{
          left: `${bar.left}%`,
          width: `${bar.width}%`,
          top: `${bar.lane * (LANE_HEIGHT + LANE_GAP)}px`,
          height: `${LANE_HEIGHT}px`,
          backgroundColor: bar.invalid ? undefined : bar.hex,
        }"
        :title="bar.title"
      >
        <span class="truncate text-[11px] font-medium text-white">
          {{ bar.label }}
        </span>
      </div>
    </div>

    <p
      v-if="bars.some(b => b.invalid)"
      class="mt-2 flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400"
    >
      <UIcon
        name="i-lucide-alert-triangle"
        class="w-3 h-3 shrink-0"
      />
      Blocks in red fall outside the event's own times.
    </p>
  </div>
</template>
