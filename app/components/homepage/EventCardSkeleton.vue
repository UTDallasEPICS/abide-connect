<template>
  <div
    class="relative block w-64 shrink-0 overflow-hidden rounded-2xl border-2 border-gray-300 bg-white text-left shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <!-- Image with date badge -->
    <div class="relative h-28 w-full overflow-hidden">
      <div class="h-full w-full bg-gray-200 animate-pulse dark:bg-gray-700" />
      <div
        class="absolute left-3 top-3 flex w-12 flex-col items-center rounded-lg border border-gray-100 bg-white/90 py-1 backdrop-blur-lg dark:border-gray-600 dark:bg-gray-800/90"
      >
        <div class="h-5 w-5 rounded bg-gray-300 animate-pulse dark:bg-gray-600" />
        <div class="h-3 w-6 rounded bg-gray-300 animate-pulse mt-0.5 dark:bg-gray-600" />
      </div>
    </div>
    <!-- Details -->
    <div class="space-y-1 px-3 py-3">
      <!-- Title -->
      <div class="h-5 w-4/5 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
      <!-- Location -->
      <div class="flex items-center gap-1">
        <div class="h-3.5 w-3.5 shrink-0 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
        <div class="h-3 w-2/3 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
      </div>
      <!-- Avatars + attendees -->
      <div class="flex items-center gap-2">
        <div class="flex -space-x-2">
          <div class="h-6 w-6 shrink-0 rounded-full bg-gray-200 animate-pulse ring-2 ring-white dark:bg-gray-700 dark:ring-gray-800" />
          <div class="h-6 w-6 shrink-0 rounded-full bg-gray-200 animate-pulse ring-2 ring-white dark:bg-gray-700 dark:ring-gray-800" />
          <div class="h-6 w-6 shrink-0 rounded-full bg-gray-200 animate-pulse ring-2 ring-white dark:bg-gray-700 dark:ring-gray-800" />
        </div>
        <div class="h-3 w-16 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
      </div>
    </div>
  </div>
</template>
