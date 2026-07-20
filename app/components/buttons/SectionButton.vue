<script setup lang="ts">
/**
 *  A reusable pill-style button group used for selecting between sections,
 * categories, or filters. Displays multiple options and highlights the
 * currently selected section.
 */

defineProps<{
  label: string
  selected: boolean
  size?: any,
}>()

const emit = defineEmits<{
  click: []
}>()

const baseClasses =
  'rounded-full font-semibold px-3 transition-none'

const selectedClasses =
  'border border-teal-700 bg-teal-700 text-white hover:bg-teal-700 active:bg-teal-700'

const unselectedClasses =
  'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-200'
</script>

<template>
  <UButton
    :size="size || 'sm'"
    :class="[
      baseClasses,
      selected ? selectedClasses : unselectedClasses
    ]"
    @click="emit('click')"
  >
    {{ label }}
  </UButton>
</template>