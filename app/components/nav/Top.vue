<script setup lang="ts">
import { authClient } from '#server/utils/auth-client'

/**
 * Top bar for the `default` layout: settings, notifications, theme, sign-out.
 *
 * The `right` slot is exposed so a page can replace the inbox button with
 * something of its own while keeping the theme and logout controls.
 */

const colorMode = useColorMode()

const onInboxClick = async (_e?: MouseEvent) => {
  await navigateTo('/inbox')
}
const onSettingsClick = async (_e?: MouseEvent) => {
  await navigateTo('/settings')
}
const onLogout = async () => {
  await authClient.signOut()
  // Full page load rather than navigateTo: it discards every cached useFetch
  // payload (roles, session, user data), so no fragment of the previous
  // account's state survives into the login screen.
  window.location.href = '/auth/login'
}
const toggleDarkMode = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <UHeader
    :ui="{ toggle: 'hidden' }"
    class="fixed top-0 z-50 h-12 w-full bg-white dark:bg-gray-900"
  >
    <template #left>
      <div class="">
        <UButton
          color="neutral"
          variant="ghost"
          aria-label="Settings"
          @click="onSettingsClick"
        >
          <UIcon
            name="i-lucide-settings"
            class="w-7 h-7 text-teal-900 dark:text-teal-400"
          />
        </UButton>
      </div>
    </template>

    <template #right>
      <div class="flex items-center gap-1">
        <slot name="right">
          <UButton
            color="neutral"
            variant="ghost"
            aria-label="Inbox"
            @click="onInboxClick"
          >
            <UIcon
              name="i-lucide-bell"
              class="w-7 h-7 text-teal-900 dark:text-teal-400"
            />
          </UButton>
        </slot>

        <!-- ← new dark mode toggle button -->
        <UButton
          color="neutral"
          variant="ghost"
          aria-label="Toggle dark mode"
          @click="toggleDarkMode"
        >
          <UIcon
            :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="w-7 h-7 text-teal-900 dark:text-teal-400"
          />
        </UButton>

        <UButton
          color="neutral"
          variant="ghost"
          aria-label="Logout"
          @click="onLogout"
        >
          <UIcon
            name="i-lucide-log-out"
            class="w-7 h-7 text-teal-900 dark:text-teal-400"
          />
        </UButton>
      </div>
    </template>
    <template #toggle />
  </UHeader>
</template>
