<script setup>
const props = defineProps({
  url: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  day: {
    type: String,
    required: true,
  },
  month: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  going: {
    type: Number,
    required: true,
  },
})

// Decorative placeholder avatars — random 2-letter initials, no attendee
// data required. Count tracks "going" (capped at 3).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function randomInitials() {
  const a = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  const b = ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return a + b
}
const avatarInitials = computed(() => {
  const count = Math.min(3, props.going)
  return Array.from({ length: count }, () => randomInitials())
})
</script>

<template>
  <NuxtLink
    :to="url"
    class="group relative block w-64 shrink-0 origin-center transform-gpu cursor-pointer overflow-hidden rounded-2xl border-2 border-gray-300 bg-white text-left shadow-sm transition-[background-color,transform] duration-100 ease-out hover:bg-gray-50 active:scale-[0.97] active:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/60 dark:active:bg-gray-700"
  >
    <!-- Hover-only click indicator -->
    <div
      class="pointer-events-none absolute right-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 opacity-0 shadow-sm transition-opacity duration-100 ease-out group-hover:opacity-100 dark:bg-gray-800/95"
    >
      <Icon
        name="heroicons:arrow-up-right-20-solid"
        class="h-3.5 w-3.5 text-gray-700 dark:text-gray-200"
      />
    </div>

    <!-- Image with date badge -->
    <div class="relative h-28 w-full overflow-hidden">
      <img
        :src="image"
        :alt="title"
        draggable="false"
        class="h-full w-full select-none object-cover"
      >
      <div
        class="absolute left-3 top-3 flex w-12 select-none flex-col items-center rounded-lg border border-gray-100 bg-white/90 py-1 backdrop-blur-lg dark:border-gray-600 dark:bg-gray-800/90"
      >
        <span class="text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100">{{ day }}</span>
        <span class="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
          {{ month }}
        </span>
      </div>
    </div>

    <!-- Details -->
    <div class="space-y-1 px-3 py-3">
      <h3 class="truncate  text-sm font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
      <p class="flex items-center gap-1 text-xs font-normal text-gray-500 dark:text-gray-400">
        <Icon
          name="heroicons:map-pin-20-solid"
          class="h-3.5 w-3.5 shrink-0"
        />
        <span class="truncate">{{ location }}</span>
      </p>

      <!-- Edge case: nobody going yet -->
      <p
        v-if="going === 0"
        class="text-xs font-normal text-gray-400 mt-2"
      >
        <span class="text-xs font-normal text-blue-600 dark:text-blue-400">0 Attendees</span>
      </p>
      <div
        v-else
        class="flex items-center gap-2"
      >
        <div class="flex -space-x-2">
          <div
            v-for="(initials, index) in avatarInitials"
            :key="index"
            class="h-6 w-6 shrink-0 rounded-full ring-2 ring-white transition-[--tw-ring-color] duration-100 ease-out group-hover:ring-gray-50 group-active:ring-gray-100 dark:ring-gray-800 dark:group-hover:ring-gray-700 dark:group-active:ring-gray-700"
          >
            <UserAvatar :name="initials" />
          </div>
        </div>
        <span class="text-xs font-normal text-blue-600 dark:text-blue-400">+{{ going }} Attendees</span>
      </div>
    </div>
  </NuxtLink>
</template>
