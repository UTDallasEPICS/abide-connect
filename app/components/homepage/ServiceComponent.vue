<script setup>
defineProps({
  url: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  footerText: {
    type: String,
    default: null,
  },
});
</script>

<template>
  <NuxtLink
    :to="url"
    class="group relative flex w-full shrink-0 origin-center transform-gpu cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-gray-300 bg-white text-left shadow-sm transition-[background-color,transform] duration-100 ease-out hover:bg-gray-50 active:scale-[0.97] active:bg-gray-100 sm:w-64"
  >
    <!-- Hover-only click indicator -->
    <div
      class="pointer-events-none absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-sm transition-opacity duration-100 ease-out group-hover:opacity-100"
    >
      <Icon name="heroicons:arrow-up-right-20-solid" class="h-3.5 w-3.5 text-gray-700" />
    </div>

    <!-- Image -->
    <div class="relative h-44 w-full overflow-hidden sm:h-60">
      <img
        :src="image"
        :alt="title"
        draggable="false"
        class="h-full w-full select-none object-cover"
      />
    </div>

    <!-- Details -->
    <div class="flex min-h-[80px] flex-col justify-start gap-1 px-3 py-2.5">
      <h3 class="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{{ title }}</h3>
      <p class="line-clamp-3 text-xs font-normal leading-relaxed text-gray-500">{{ description }}</p>
    </div>

    <!-- Bottom footer field -->
    <div
      v-if="footerText"
      class="mt-auto flex items-center justify-between border-t border-gray-100 px-3 py-2"
    >
      <span class="truncate text-xs font-medium text-gray-500">{{ footerText }}</span>
      <Icon name="heroicons:arrow-right-20-solid" class="h-4 w-4 shrink-0 text-gray-400" />
    </div>
  </NuxtLink>
</template>