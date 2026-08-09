<script setup lang="ts">
import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date'

const timeZone = getLocalTimeZone()
const todayDate = today(timeZone)

const selected = shallowRef(todayDate)
const anchor = shallowRef(todayDate)

const weekdayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const weekDays = computed(() => {
  const dayOfWeek = anchor.value.toDate(timeZone).getDay()
  const startOfWeek = anchor.value.subtract({ days: dayOfWeek })
  return Array.from({ length: 7 }, (_, i) => startOfWeek.add({ days: i }))
})

const monthLabel = computed(() =>
  weekDays.value[0].toDate(timeZone).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

function isToday(date: CalendarDate) {
  return date.compare(todayDate) === 0
}
function isSelected(date: CalendarDate) {
  return date.compare(selected.value) === 0
}
function selectDay(date: CalendarDate) {
  selected.value = date
  anchor.value = date
}
function prevWeek() {
  anchor.value = anchor.value.subtract({ weeks: 1 })
}
function nextWeek() {
  anchor.value = anchor.value.add({ weeks: 1 })
}
</script>

<template>
  <div class="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4">
    <div class="mb-4 flex items-center justify-between">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" size="sm" square @click="prevWeek" />
      <span class="text-[15px] font-medium text-gray-900">{{ monthLabel }}</span>
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" size="sm" square @click="nextWeek" />
    </div>

    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="(date, i) in weekDays"
        :key="date.toString()"
        class="flex flex-col items-center gap-1.5 rounded-lg py-1"
        @click="selectDay(date)"
      >
        <span class="text-[11px] font-medium uppercase text-gray-400">{{ weekdayNames[i] }}</span>
        <span
          class="flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium"
          :class="isSelected(date) ? 'bg-orange-100 text-orange-600' : 'text-gray-900'"
        >
          {{ date.day }}
        </span>
        <span class="h-1 w-1 rounded-full" :class="isToday(date) ? 'bg-primary-500' : 'bg-transparent'" />
      </button>
    </div>
  </div>
</template>