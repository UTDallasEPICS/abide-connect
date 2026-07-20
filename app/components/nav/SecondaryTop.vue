<script setup lang="ts">
const router = useRouter()
const route = useRoute()
</script>

<template>
  <UHeader
    :ui="{
      toggle: 'hidden',
      root: 'border-b-0 shadow-none'
    }"
    class="text-teal-700 fixed top-0 z-50 h-19 w-full bg-white dark:bg-gray-900"
  >
    <template #left>
      
      <UButton
        color="neutral"
        variant="ghost"
        class="gap-1"
        @click="router.back()"
      >
        <span class="text-lg">&lt;</span>
      </UButton>

      <span
        v-if="route.meta.backText"
        class="font-normal"
      >
        {{ route.meta.backText }}
      </span>

    </template>

    <template #toggle />
  </UHeader>
</template>