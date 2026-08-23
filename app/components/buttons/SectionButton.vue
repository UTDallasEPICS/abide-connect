<script setup lang="ts">
/**
 *  A reusable pill-style button group used for selecting between sections,
 * categories, or filters. Displays multiple options and highlights the
 * currently selected section.
 */
defineProps<{
  label: string
  selected: boolean
  size?: string
}>()
const emit = defineEmits<{
  click: []
}>()
const baseClasses
  = 'rounded-full font-semibold px-3 transition-none'

const selectedClasses
  = 'border border-brand9 bg-brand9 text-white hover:bg-brand9 active:bg-brand9 '
    + 'dark:border-brand8 dark:bg-brand8 dark:text-gray-900 dark:hover:bg-brand8 dark:active:bg-brand8'

const unselectedClasses
  = 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-200 '
    + 'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:active:bg-gray-600'
</script>

<template>
  <UButton
    :size="size || 'sm'"
    :class="[
      baseClasses,
      selected ? selectedClasses : unselectedClasses,
    ]"
    @click="emit('click')"
  >
    {{ label }}
  </UButton>
</template>
