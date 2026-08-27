<script setup lang="ts">
import SectionButton from '~/components/buttons/SectionButton.vue'
import UserAvatar from '~/components/UserAvatar.vue'
import type { UsersResponse } from '~/types/admin/admin-user-response'

definePageMeta({
  layout: 'secondary',
  backText: 'Admin',
  backTo: '/admin',
})

/**
 * Paginated, searchable member directory.
 *
 * Search, role filter and pagination all live server-side (see
 * `/api/admin/users`), so this page holds only the query state and re-fetches
 * when it changes — the full member list is never loaded into the browser.
 *
 * Changing the search or filter resets to page 1, since the current page number
 * is meaningless against a different result set.
 */

type RoleFilter = 'ALL' | 'VOLUNTEER' | 'ADMIN'

const PAGE_SIZE = 10
/* Wait for a pause in typing before querying, so each keystroke isn't a
   round-trip. Clearing the box skips the debounce and resets immediately. */
const SEARCH_DEBOUNCE_MS = 200
/* A loading screen only shows up if a fetch is still pending after this long.  */
const LOADING_SCREEN_DELAY_MS = 100

const selectedRoleFilter = ref<RoleFilter>('ALL')
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

watch(selectedRoleFilter, () => {
  page.value = 1
})

const { data, pending, error, refresh } = await useFetch<UsersResponse>('/api/admin/users', {
  query: {
    search: debouncedSearch,
    role: selectedRoleFilter,
    page,
    pageSize: PAGE_SIZE,
  },
  watch: [debouncedSearch, selectedRoleFilter, page],
})

// ---- Keep page in range ----
watch(data, (val) => {
  if (val && val.totalPages > 0 && page.value > val.totalPages) {
    page.value = val.totalPages
  }
})

// ---- Loading screen ----
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
    }
    else {
      showLoadingScreen.value = false
    }
  },
  { immediate: true },
)

const users = computed(() => data.value?.users ?? [])
const totalUsers = computed(() => data.value?.total ?? 0)

// UPagination's activeBgColor is a plain color-name prop, not a Tailwind
// class, so it can't be styled with a `dark:` variant — switch it manually
// based on the current color mode instead.
const colorMode = useColorMode()
const paginationActiveBgColor = computed(() => (colorMode.value === 'dark' ? 'gray-700' : 'gray-200'))

// ---- Role filters ----
const roleFilters = computed(() => [
  { label: `USERS (${data.value?.counts.all ?? 0})`, value: 'ALL' },
  { label: `VOLUNTEERS (${data.value?.counts.volunteer ?? 0})`, value: 'VOLUNTEER' as const },
  { label: `ADMINS (${data.value?.counts.admin ?? 0})`, value: 'ADMIN' as const },
])

const roleStyles: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  VOLUNTEER: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  USER: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}
</script>

<template>
  <div class="overflow-x-hidden">
    <div class="w-full max-w-(--ui-container) mx-auto min-h-[calc(100vh-4.75rem)] flex flex-col">
      <!-- Header -->
      <div class="mx-10">
        <h1 class="text-2xl font-normal">
          <span class="font-light text-gray-500 dark:text-gray-400">Member</span>
          <br>
          <span class="text-[var(--color-brand9)] dark:text-[var(--color-brand8)] font-bold">Management</span>
        </h1>

        <!-- Search -->
        <UInput
          v-model="search"
          placeholder="Search members..."
          class="w-full my-5 font-normal"
          icon="i-lucide-search"
        />

        <!-- Role filters -->
        <div class="w-full flex gap-2">
          <SectionButton
            v-for="filter in roleFilters"
            :key="filter.value"
            :label="filter.label"
            :selected="selectedRoleFilter === filter.value"
            @click="selectedRoleFilter = filter.value"
          />
        </div>
      </div>

      <!-- Backdrop -->
      <div class="w-screen relative left-1/2 right-1/2 -mx-[50vw] bg-gray-50 dark:bg-gray-900 flex-1 min-h-0 mt-7 rounded-4xl">
        <div class="w-full max-w-(--ui-container) mx-auto px-4 sm:px-10 pt-5 pb-10 h-full flex flex-col">
          <!-- User list -->
          <div class="w-full flex-1 min-h-0 rounded-lg border border-gray-300 dark:border-gray-700 divide-y divide-gray-300 dark:divide-gray-700 overflow-y-auto bg-white dark:bg-gray-800">
            <!-- Loading -->
            <div
              v-if="showLoadingScreen"
              class="flex items-center justify-center py-16"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="animate-spin text-3xl text-gray-400 dark:text-gray-500"
              />
            </div>

            <!-- Error -->
            <div
              v-else-if="error"
              class="flex flex-col items-center justify-center text-center py-16 px-6"
            >
              <p class="text-sm text-red-400 dark:text-red-400">
                Something went wrong loading members.
              </p>
              <UButton
                class="mt-3"
                size="sm"
                variant="solid"
                @click="refresh()"
              >
                Retry
              </UButton>
            </div>

            <!-- User row -->
            <div
              v-for="user in users"
              v-else
              :key="user.id"
              class="p-3 flex items-center justify-between"
            >
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-10 h-10 shrink-0">
                  <UserAvatar
                    :name="user.name"
                    :src="user.avatarUrl"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {{ user.name }}
                  </p>
                  <p class="font-normal text-gray-400 dark:text-gray-500 text-sm truncate">
                    {{ user.email }}
                  </p>
                  <!-- Roles -->
                  <div class="flex gap-1 mt-2">
                    <div
                      v-for="role in user.roles"
                      :key="role"
                      class="font-semibold text-[10px] sm:text-xs rounded-full py-0.5 px-2 sm:py-1 sm:px-3"
                      :class="roleStyles[role]"
                    >
                      {{ role }}
                    </div>
                    <div class="whitespace-nowrap font-normal text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 py-0.5 px-2 sm:py-1 sm:px-3">
                      {{ user.hours }} hours
                    </div>
                  </div>
                </div>
              </div>

              <!-- Edit button -->
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                color="neutral"
                class="text-gray-400 dark:text-gray-500"
                @click="navigateTo(`/admin/member-management/${user.id}`)"
              />
            </div>

            <!-- Empty state -->
            <div
              v-if="!showLoadingScreen && !error && users.length === 0"
              class="flex flex-col items-center justify-center text-center py-16 px-6"
            >
              <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
                No users found.
              </p>
            </div>
          </div>

          <!-- Pagination -->
          <div class="w-full flex justify-center pt-4">
            <UPagination
              v-model:page="page"
              :items-per-page="PAGE_SIZE"
              :total="totalUsers"
              :disabled="showLoadingScreen"
              :sibling-count="1"
              :active-bg-color="paginationActiveBgColor"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
