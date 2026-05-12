<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'secondary',
})

// type for API
type Notification = {
  id: string
  title: string
  content: string
  createdAt: string
  isRead: boolean
}

const { data: sessionData } = await useFetch('/api/auth/get-session')
const userId = computed(() => sessionData.value?.user?.id ?? 'null')

const notifications = ref<Notification[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const fetchNotification = async () => {
  if (!userId.value) return
  loading.value = true
  error.value = null

  try {
    const data = await $fetch<{ notifications: Notification[] }>(
      `/api/notification/${userId.value}`,
    )
    notifications.value = data.notifications
  }
  catch (err) {
    console.error('Failed to fetch notifications', err)
    error.value = 'Failed to load notifications'
  }
  finally {
    loading.value = false
  }
}
watch(
  userId,
  (id) => {
    if (id) fetchNotification()
  },
  { immediate: true },
)

// console.log('sessionData:', sessionData.value)
// console.log('userId:', userId.value)

// map to uaccordion items
const accordionItems = computed(() =>
  notifications.value.map(n => ({
    id: n.id,
    label: n.title,
    content: n.content,
    // icon: "i-heroicons-bell",
    time: formatTime(n.createdAt),
    isRead: n.isRead,
  })),
)

const markAsRead = (id: string) => {
  const notification = notifications.value.find(n => n.id == id)
  if (notification && !notification.isRead) {
    notification.isRead = true
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
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
  <div class="min-h-screen flex flex-col bg-white dark:bg-gray-900">
    <!-- Notifications accordion -->
    <div class="flex-1 w-full mx-auto mt-15">
      <UAccordion
        type="multiple"
        class="bg-white w-full px-5 mb-10"
        :items="accordionItems"
        :ui="{
          item: 'border-none pr-2 mt-5',
          header: true
            ? 'text-[20px] font-extrabold text-[#3a696e]'
            : 'text-[20px] font-semibold text-[#3a696e]',
          trigger: 'block w-full text-left p-0',
          trailingIcon: 'hidden pointer-events-none',
        }"
      >
        <!-- Header -->
        <template #default="{ item, open }">
          <div
            class="w-full"
            @click="markAsRead(item.id)"
          >
            <div
              class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 w-full"
            >
              <UIcon
                name="i-heroicons-bell"
                class="w-5 h-5 text-[#3a696e]"
              />
              <h3
                class="min-w-0 line-clamp-1 truncate leading-tight"
                :class="
                  !item.isRead
                    ? 'text-[20px] font-extrabold text-[#3a696e]'
                    : 'text-[20px] font-semibold text-[#3a696e]'
                "
              >
                {{ item.label }}
              </h3>

              <span
                class="whitespace-nowrap text-[13px] text-brand7 leading-tight"
              >
                {{ item.time }}
              </span>
              <UIcon
                name="i-heroicons-chevron-down-20-solid"
                class="w-5 h-5 transition-transform duration-200"
                :class="open ? 'rotate-180' : ''"
              />
            </div>
            <p
              v-show="!open"
              class="pl-7 mt-5"
              :class="
                !item.isRead
                  ? 'font-bold text-[13px] text-gray-600 leading-relaxed line-clamp-1'
                  : 'font-semibold text-[13px] text-gray-600 leading-relaxed line-clamp-1'
              "
            >
              {{ item.content }}
            </p>
          </div>
        </template>
        <!-- body message -->
        <template #content="{ item }">
          <div class="overflow-hidden">
            <p
              class="font-semibold text-[13px] text-gray-600 leading-relaxed"
            >
              {{ item.content }}
            </p>
          </div>
        </template>
      </UAccordion>
    </div>
  </div>
</template>
