<template>
  <div class="bg-transparent select-none w-full max-w-md mx-auto font-sans">
    <!-- Header: current selected date -->
    <div class="text-center mb-3">
      <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">
        {{ headerLabel }}
      </h2>
    </div>

    <!-- Week strip -->
    <div class="flex items-center justify-between gap-1">
      <!-- Prev arrow -->
      <button
        type="button"
        @click="shiftWeek(-1)"
        class="shrink-0 p-1 text-gray-300 dark:text-gray-600 hover:text-teal-700 dark:hover:text-teal-500"
        aria-label="Previous week"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <!-- Days -->
      <div class="flex flex-1 justify-between">
        <button
          v-for="day in weekDays"
          :key="day.dateString"
          type="button"
          @click="selectDay(day)"
          class="flex flex-col items-center justify-center gap-1 rounded-md px-2 py-2.5 min-w-[42px]"
          :class="isSelected(day)
            ? 'bg-teal-700 dark:bg-teal-600'
            : 'hover:bg-teal-50 dark:hover:bg-teal-950'"
        >
          <span
            class="text-xl font-semibold leading-none"
            :class="isSelected(day) ? 'text-white' : 'text-gray-800 dark:text-gray-100'"
          >
            {{ day.date }}
          </span>
          <span
            class="text-[10px] font-medium tracking-wide leading-none"
            :class="isSelected(day) ? 'text-teal-100' : 'text-gray-400 dark:text-gray-500'"
          >
            {{ day.dayShort }}
          </span>
        </button>
      </div>

      <!-- Next arrow -->
      <button
        type="button"
        @click="shiftWeek(1)"
        class="shrink-0 p-1 text-gray-300 dark:text-gray-600 hover:text-teal-700 dark:hover:text-teal-500"
        aria-label="Next week"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Date,
    default: () => new Date(),
  },
})

const emit = defineEmits(['update:modelValue'])

const selectedDate = ref(props.modelValue ? new Date(props.modelValue) : new Date())
// Anchor date controls which week is currently visible
const anchorDate = ref(new Date(selectedDate.value))

const dayShortNames = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT']
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function startOfWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function dateKey(d) {
  return d.toDateString()
}

function ordinalSuffix(n) {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return 'st'
  if (j === 2 && k !== 12) return 'nd'
  if (j === 3 && k !== 13) return 'rd'
  return 'th'
}

const weekDays = computed(() => {
  const start = startOfWeek(anchorDate.value)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      date: d.getDate(),
      dayShort: dayShortNames[d.getDay()],
      dateString: dateKey(d),
      fullDate: d,
    }
  })
})

const headerLabel = computed(() => {
  const d = selectedDate.value
  const weekdayFull = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][d.getDay()]
  return `${weekdayFull} ${monthNames[d.getMonth()]} ${d.getDate()}${ordinalSuffix(d.getDate())}`
})

function isSelected(day) {
  return day.dateString === dateKey(selectedDate.value)
}

function selectDay(day) {
  selectedDate.value = new Date(day.fullDate)
  emit('update:modelValue', new Date(day.fullDate))
}

function shiftWeek(direction) {
  const d = new Date(anchorDate.value)
  d.setDate(d.getDate() + direction * 7)
  anchorDate.value = d

  // Keep the same weekday position (e.g. still "Wednesday") in the new week
  const newSelected = startOfWeek(d)
  newSelected.setDate(newSelected.getDate() + selectedDate.value.getDay())
  selectedDate.value = newSelected
  emit('update:modelValue', newSelected)
}
</script>