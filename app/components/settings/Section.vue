<script setup lang="ts">
/** Card wrapper shared by every block on the settings page. */
defineProps<{
  title: string
  description?: string
  /** Renders the header in the error colour, for destructive sections. */
  danger?: boolean
}>()
</script>

<template>
  <section
    class="rounded-3xl border px-5 py-5 shadow-md"
    :class="danger
      ? 'border-error/40 bg-error/5 dark:border-error/40 dark:bg-error/10'
      : 'border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900/60'"
  >
    <header class="mb-4">
      <h2
        class="text-lg font-semibold"
        :class="danger ? 'text-error' : 'text-brand4 dark:text-brand8'"
      >
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="mt-1 text-xs font-normal text-gray-500 dark:text-gray-400"
      >
        {{ description }}
      </p>
    </header>

    <div class="space-y-4">
      <slot />
    </div>
  </section>
</template>
