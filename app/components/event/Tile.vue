<script setup lang="ts">
defineEmits(['add'])
defineProps<{
  title: string
  subtitle?: string
}>()
</script>
<template>
  <div
    class="flex items-center gap-4 rounded-[22px] border border-gray-800/70 dark:border-gray-700/60
           bg-white/70 dark:bg-gray-900/60 backdrop-blur px-4 py-3 shadow-sm"
  >
    <!-- Square avatar -->
    <div class="h-12 w-12 rounded-2xl bg-gray-300/70 dark:bg-gray-600/60 border border-gray-800/60"/>

    <!-- Text lines -->
    <div class="flex-1">
      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
      {{ title }}
      </p>

      <p class="text-xs text-gray-500 dark:text-gray-400">
      {{ subtitle }}
      </p>
    </div>

    <!-- Plus button -->
    <button
      class="grid place-items-center rounded-xl h-9 w-9 border border-gray-800/70 dark:border-gray-700/60
             hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition"
      @click="$emit('add')"
    >
      <UIcon name="i-heroicons-plus" class="w-5 h-5" />
    </button>
  </div>
</template>