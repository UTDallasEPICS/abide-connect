<script setup lang="ts">
import SectionButton from '~/components/buttons/SectionButton.vue';
import UserAvatar from '~/components/UserAvatar.vue';

definePageMeta({
  layout: 'secondary',
  backText: 'Management'
})

interface ApiUser {
  id: string
  name: string
  email: string
  roles: ('USER' | 'ADMIN' | 'VOLUNTEER')[]
  hours: number
  avatarUrl?: string | null
}

interface UsersResponse {
  users: ApiUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: { all: number; volunteers: number; admins: number }
}

type RoleFilter = 'ALL' | 'VOLUNTEER' | 'ADMIN'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 200
// A loading screen only shows up if a fetch is still pending after this long —
// fast responses swap the data in with no visible loading state at all.
const LOADING_SCREEN_DELAY_MS = 100

const selected = ref<RoleFilter>('ALL')
const debouncedSearch = ref('')
const search = ref('')
const page = ref(1)

// ---- Debounced search ----
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

watch(search, (value) => {
  clearTimeout(searchDebounceTimer)

  if (value === '') {
    debouncedSearch.value = ''
    page.value = 1
    return
  }

  searchDebounceTimer = setTimeout(() => {
    debouncedSearch.value = value
    page.value = 1
  }, SEARCH_DEBOUNCE_MS)
})

watch(selected, () => {
  page.value = 1
})

const { data, pending, error, refresh } = await useFetch<UsersResponse>('/api/admin/users', {
  query: {
    search: debouncedSearch,
    role: selected,
    page,
    pageSize: PAGE_SIZE,
  },
  watch: [debouncedSearch, selected, page],
})

// ---- Delayed loading screen ----
// `data` keeps its previous value while a new fetch is in flight, so nothing
// changes on screen the moment a request starts. Only if it's still pending
// after LOADING_SCREEN_DELAY_MS do we swap to a spinner.
const showLoadingScreen = ref(false)
let loadingScreenTimer: ReturnType<typeof setTimeout> | undefined

watch(
  pending,
  (isPending) => {
    clearTimeout(loadingScreenTimer)

    if (isPending) {
      loadingScreenTimer = setTimeout(() => {
        showLoadingScreen.value = true
      }, LOADING_SCREEN_DELAY_MS)
    } else {
      showLoadingScreen.value = false
    }
  },
  { immediate: true }
)

const users = computed(() => data.value?.users ?? [])
const total = computed(() => data.value?.total ?? 0)

const filters = computed(() => [
  { label: `USERS (${data.value?.counts.all ?? 0})`, value: 'ALL' as const },
  { label: `VOLUNTEERS (${data.value?.counts.volunteers ?? 0})`, value: 'VOLUNTEER' as const },
  { label: `ADMINS (${data.value?.counts.admins ?? 0})`, value: 'ADMIN' as const },
])

const roleStyles: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  VOLUNTEER: 'bg-amber-100 text-amber-700',
  USER: 'bg-gray-200 text-gray-600',
}

const roleOrder: Record<string, number> = {
  ADMIN: 0,
  VOLUNTEER: 1,
  USER: 2,
}

function sortedRoles(roles: ApiUser['roles']) {
  return [...roles].sort((a, b) => roleOrder[a] - roleOrder[b])
}
</script>

<template>
  <div class="w-full max-w-(--ui-container) mx-auto mt-19 min-h-[calc(100vh-4.75rem)] flex flex-col">
    <div class="mx-10">
      <h1 class="text-2xl font-normal">
        <span class="font-light text-gray-500">Member</span>
        <br>
        <span class="text-teal-700 font-bold">Management</span>
      </h1>
      <UInput
        v-model="search"
        placeholder="Search members..."
        class="w-full my-5 font-normal"
        icon="i-lucide-search"
      />
      <div class="w-full flex gap-2">
        <SectionButton
          v-for="filter in filters"
          :key="filter.value"
          :label="filter.label"
          :selected="selected === filter.value"
          @click="selected = filter.value"
        />
      </div>
    </div>

    <!-- Gray backdrop -->
    <div class="w-screen relative left-1/2 right-1/2 -mx-[50vw] bg-gray-50 flex-1 min-h-0 mt-7 rounded-4xl">
      <div class="w-full max-w-(--ui-container) mx-auto px-10 pt-5 pb-10 h-full flex flex-col">
        <div class="w-full flex-1 min-h-0 rounded-lg border border-gray-300 divide-y divide-gray-300 overflow-y-auto bg-white">
          <!-- Loading screen -->
          <div v-if="showLoadingScreen" class="flex items-center justify-center py-16">
            <UIcon name="i-lucide-loader-2" class="animate-spin text-3xl text-gray-400" />
          </div>

          <!-- Error state -->
          <div v-else-if="error" class="flex flex-col items-center justify-center text-center py-16 px-6">
            <p class="text-sm text-red-400">Something went wrong loading members.</p>
            <UButton class="mt-3" size="sm" variant="solid" @click="refresh()">Retry</UButton>
          </div>

          <!-- Users -->
          <div
            v-else
            v-for="user in users"
            :key="user.id"
            class="p-3 flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 shrink-0">
                <UserAvatar :name="user.name" :src="user.avatarUrl" />
              </div>

              <div>
                <p class="font-semibold">{{ user.name }}</p>
                <p class="font-normal text-gray-400 text-sm">{{ user.email }}</p>
                <div class="flex gap-1 mt-2">
                  <div
                    v-for="role in sortedRoles(user.roles)"
                    :key="role"
                    class="font-semibold text-xs rounded-full py-1 px-3"
                    :class="roleStyles[role]"
                  >
                    {{ role }}
                  </div>  
                  <div class="font-normal text-xs text-gray-400 py-1 px-3">
                    {{ user.hours }} hours
                  </div>
                </div>
              </div>
            </div>

            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              class="text-gray-400"
              @click="navigateTo(`/admin/member-management/${user.id}`)"
            />
          </div>

          <!-- Empty state -->
          <div
            v-if="!showLoadingScreen && !error && users.length === 0"
            class="flex flex-col items-center justify-center text-center py-16 px-6"
          >
            <p class="text-sm text-gray-400 mt-1">No users found.</p>
          </div>
        </div>

        <div class="w-full flex justify-center pt-4">
          <UPagination
            v-model:page="page"
            :page-count="PAGE_SIZE"
            :total="total"
            :disabled="showLoadingScreen || users.length == 0"
            activeColor="neutral"
            activeBgColor="gray-200"
          />
        </div>
      </div>
    </div>
  </div>
</template>