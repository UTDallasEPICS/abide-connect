<script setup lang="ts">
defineProps<{
  title: string
}>();
</script>

<template>
  <div class="mt-5">
    <h1 class="text-xl font-medium my-2">{{ title }}</h1>
    <hr class="border-gray-300 mb-2">
    <slot />
  </div>
</template>