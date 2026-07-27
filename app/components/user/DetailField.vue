<script setup lang="ts">
defineProps<{
  label: string
  value?: string | number | string[] | null
}>();
</script>

<template>
  <div class="mb-4">
    <h2 class="text-teal-700 font-bold">{{ label }}</h2>
    <p class="font-normal ">
      {{ Array.isArray(value) ? (value.length ? value.join(', ') : '-') : (value ?? '-') }}
    </p>
  </div>
</template>