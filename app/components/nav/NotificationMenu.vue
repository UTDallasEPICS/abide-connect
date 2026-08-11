<script setup lang="ts">
/**
 * Bell button in `NavTop` that opens the notification list as a dropdown.
 *
 * This replaces the old `/inbox` page — notifications are read in place, so a
 * route change (and losing whatever page you were on) is no longer the price of
 * checking them.
 *
 * Two per-row actions, both applied optimistically and rolled back if the
 * server rejects them:
 *  - expanding a row PATCHes it read. Only the first expand writes; reopening
 *    an already-read row is local.
 *  - dismissing DELETEs the user's join row.
 *
 * `/api/notification/[id]` ignores its route parameter and resolves the
 * recipient from the session, hence the placeholder `self` segment. The fetch
 * only runs client-side and only when a session exists; logged-out visitors
 * see a "sign in" prompt in the dropdown instead.
 */

type NotificationItem = {
  id: string
  title: string
  content: string
  createdAt: string
  isRead: boolean
}

const { roles } = useUserRoles()
const signedIn = computed(() => roles.value.length > 0)

const notifications = ref<NotificationItem[]>([])

const { data, refresh } = useFetch<
  { success: boolean, notifications: NotificationItem[] } | undefined
>('/api/notification/self', {
  key: 'notifications',
  immediate: false,
  default: () => undefined,
})

watch(
  () => [signedIn.value, data.value] as const,
  ([isSignedIn, value]) => {
    notifications.value = isSignedIn ? value?.notifications ?? [] : []
  },
  { immediate: true },
)

// Fetch only after hydration and only when signed in — no SSR fetch, so
// logged-out page renders issue zero notification requests.
watch(signedIn, (isSignedIn) => {
  if (isSignedIn && import.meta.client) refresh()
})

const unreadCount = computed(
  () => notifications.value.filter(n => !n.isRead).length,
)

const open = ref(false)
// Re-check on open so a tab left sitting for an hour isn't showing a stale list.
watch(open, (isOpen) => {
  if (isOpen && signedIn.value) refresh()
})

const expandedId = ref<string | null>(null)
const toggle = async (notification: NotificationItem) => {
  expandedId.value = expandedId.value === notification.id ? null : notification.id
  if (notification.isRead) return

  notification.isRead = true
  try {
    await $fetch(`/api/notification/${notification.id}`, {
      method: 'PATCH',
      body: { isRead: true },
    })
  }
  catch (err) {
    console.error('Failed to mark notification read', err)
    notification.isRead = false
  }
}

const dismiss = async (id: string) => {
  const previous = notifications.value
  notifications.value = previous.filter(n => n.id !== id)
  if (expandedId.value === id) expandedId.value = null

  try {
    await $fetch(`/api/notification/${id}`, { method: 'DELETE' })
  }
  catch (err) {
    console.error('Failed to dismiss notification', err)
    notifications.value = previous
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
    :ui="{ content: 'w-[min(22rem,calc(100vw-1rem))]' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      aria-label="Notifications"
    >
      <span class="relative flex">
        <UIcon
          name="i-lucide-bell"
          class="w-6 h-6 text-gray-900 dark:text-teal-400"
        />
        <span
          v-if="unreadCount"
          class="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </span>
    </UButton>

    <template #content>
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-base font-extrabold text-[#3a696e] dark:text-teal-400">
          Notifications
        </h2>
        <span
          v-if="unreadCount"
          class="text-[13px] text-brand7"
        >
          {{ unreadCount }} new
        </span>
      </div>

      <div class="max-h-[60vh] overflow-y-auto">
        <template v-if="!signedIn">
          <div class="px-4 py-6 text-center">
            <p class="text-[13px] text-gray-500 dark:text-gray-400">
              Sign in to receive notifications.
            </p>
            <UButton
              color="primary"
              size="sm"
              class="mt-3"
              icon="i-lucide-log-in"
              to="/auth/login"
            >
              Sign in
            </UButton>
          </div>
        </template>
        <p
          v-else-if="!notifications.length"
          class="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-gray-400"
        >
          You're all caught up.
        </p>

        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="flex items-start gap-2 px-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-none"
        >
          <button
            type="button"
            class="flex-1 min-w-0 text-left cursor-pointer"
            @click="toggle(notification)"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-bell"
                class="shrink-0 w-4 h-4 text-[#3a696e] dark:text-teal-400"
              />
              <h3
                class="min-w-0 flex-1 truncate text-[15px] leading-tight text-[#3a696e] dark:text-teal-400"
                :class="notification.isRead ? 'font-semibold' : 'font-extrabold'"
              >
                {{ notification.title }}
              </h3>
              <span class="shrink-0 whitespace-nowrap text-[12px] text-brand7">
                {{ formatTime(notification.createdAt) }}
              </span>
            </div>
            <p
              class="pl-6 mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300"
              :class="[
                notification.isRead ? 'font-semibold' : 'font-bold',
                expandedId === notification.id ? '' : 'line-clamp-1',
              ]"
            >
              {{ notification.content }}
            </p>
          </button>

          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-x"
            :aria-label="`Dismiss ${notification.title}`"
            class="shrink-0 self-center"
            @click="dismiss(notification.id)"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
