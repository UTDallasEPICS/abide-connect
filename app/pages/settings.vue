<script setup lang="ts">
definePageMeta({
  layout: 'secondary',
})

const colorMode = useColorMode();

// type for the select
type NotificationType = 'General Events' | 'Volunteer Events' | 'Both'

const notificationEnabled = ref(true)
const notificationType = ref<NotificationType>('General Events')

const notificationOptions = [
  { label: 'General Events', value: 'general' },
  { label: 'Volunteer Events', value: 'volunteer' },
  { label: 'Both', value: 'both' },
]

const switchColor = computed(() =>
  colorMode.value === 'dark' ? 'brand5' : 'brand7'
)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- top nav bar with back button -->
    <main class="flex-1 px-5 pt-20 pb-24">
      <h2 class="text-xl font-semibold mb-6 text-brand7 dark:text-teal-400">
        Event Notifications
      </h2>

      <section class="space-y-5">
        <div class="w-full rounded-3xl border border-gray-800/70 bg-slate-100 px-4 py-4 flex items-center justify-between dark:bg-gray-900/60 dark:border-gray-700/60 shadow-md">
          <span class="text-sm font-semibold text-">Enable Notifications</span>

          <USwitch
            v-model="notificationEnabled"
            :color="switchColor"
          />
        </div>
        <!-- notification type -->
        <div
          v-if="notificationEnabled"
          class="w-full rounded-3xl border border-gray-2-400 bg-white px-4 py-3 flex items-center justify-between  dark:bg-gray-900/60 dark:border-gray-700/60 shadow-md"
        >
          <span class="text-sm font-semibold text-brand4 dark:text-white">Notification Type</span>
          <USelect
            v-model="notificationType"
            :items="notificationOptions"
            size="sm"
            class="w-40"
            color="brand6"
          />
        </div>
      </section>
    </main>
  </div>
</template>
