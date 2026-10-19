<script setup lang="ts">
/**
 * Fixed bottom tab bar, shown by the `default` layout.
 *
 * The last tab is role-dependent: admins land on the dashboard, everyone else
 * on their volunteer profile. It's a computed rather than a static list because
 * `useUserRoles` resolves asynchronously, so the destination fills in once
 * roles arrive.
 *
 * The row is `--nav-bottom-h` (main.css) tall plus the safe-area inset, and
 * each tab fills its share of the width and the row's full height, so the
 * whole cell is the touch target rather than just the 24px icon. The tabs are
 * icon-only, so each carries an `aria-label` for screen readers.
 */
const { isAdmin } = useUserRoles()

// Admins get the dashboard; everyone else gets their profile.
const profileLink = computed(() => (isAdmin.value ? '/admin' : '/volunteer'))

const nav = computed(() => [
  {
    id: 1,
    icon: 'i-lucide-house',
    label: 'Home',
    to: '/',
  },
  {
    id: 2,
    icon: 'i-lucide-calendar-days',
    label: 'Events',
    to: '/events',
  },
  {
    id: 3,
    icon: 'i-lucide-hospital',
    label: 'Mobile clinic',
    to: '/mobileClinic',
  },
  {
    id: 4,
    icon: 'i-lucide-square-user-round',
    label: isAdmin.value ? 'Admin dashboard' : 'Profile',
    to: profileLink.value,
  },
])
</script>

<template>
  <UFooter
    class="fixed bottom-0 left-0 right-0 z-60 flex justify-between items-center px-4 h-[calc(var(--nav-bottom-h)+var(--safe-bottom))] pb-(--safe-bottom) border-t border-gray-200 dark:border-gray-700 dark:bg-gray-900 bg-white/90 backdrop-blur-lg"
  >
    <template #default>
      <UButton
        v-for="navItem in nav"
        :key="navItem.id"
        :icon="navItem.icon"
        :to="navItem.to"
        :aria-label="navItem.label"
        color="neutral"
        variant="ghost"
        size="xl"
        class="flex-1 min-w-0 h-full justify-center lg:mx-25"
      />
    </template>
  </UFooter>
</template>
