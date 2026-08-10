<script setup lang="ts">
/**
 * Fixed bottom tab bar, shown by the `default` layout.
 *
 * The last tab is role-dependent: admins land on the dashboard, everyone else
 * on their volunteer profile. It's a computed rather than a static list because
 * `useUserRoles` resolves asynchronously, so the destination fills in once
 * roles arrive.
 *
 * NOTE: the buttons below carry `**flex-1**` / `**min-w-0**` in their class
 * attribute. Those aren't valid Tailwind classes — the asterisks are leftover
 * markdown emphasis, so neither rule applies and the tabs don't share width
 * evenly. Should be plain `flex-1 min-w-0`.
 */
const { isAdmin } = useUserRoles()

// Admins get the dashboard; everyone else gets their profile.
const profileLink = computed(() => (isAdmin.value ? '/admin' : '/volunteer'))

const nav = computed(() => [
  {
    id: 1,
    icon: 'i-lucide-house',
    to: '/',
  },
  {
    id: 2,
    icon: 'i-lucide-calendar-days',
    to: '/events',
  },
  {
    id: 3,
    icon: 'i-lucide-hospital',
    to: '/mobileClinic',
  },
  {
    id: 4,
    icon: 'i-lucide-square-user-round',
    to: profileLink.value,
  },
])
</script>

<template>
  <UFooter
    class="fixed bottom-0 left-0 right-0 z-60 flex justify-between items-center px-4 h-12 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
  >
    <template #default>
      <UButton
        v-for="navItem in nav"
        :key="navItem.id"
        :icon="navItem.icon"
        :to="navItem.to"
        color="neutral"
        variant="ghost"
        class="**flex-1** **min-w-0** h-full mx-auto lg:mx-25"
      />
    </template>
  </UFooter>
</template>
