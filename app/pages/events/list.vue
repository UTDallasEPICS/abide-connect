<script setup lang="ts">
import SectionButton from '~/components/buttons/SectionButton.vue'
import SecondaryEventCard from '~/components/event/SecondaryEventCard.vue'

definePageMeta({
  // Puts the back arrow in `NavTop`; the target is the fallback for a cold open.
  backTo: '/events',
})

type EventFilter = 'ALL' | 'PAST'

interface EventListItem {
  id: string
  title: string
  url: string
  image: string
  startTime: string
  location: string
}

interface EventsResponse {
  events: EventListItem[]
  total: number
  totalPages: number
  counts: {
    all: number
  }
}

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 200
const LOADING_SCREEN_DELAY_MS = 100

const selectedFilter = ref<EventFilter>('ALL')
const debouncedSearch = ref('')
const search = ref('')
const page = ref(1)

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

watch(selectedFilter, () => {
  page.value = 1
})

const { data, pending, error, refresh } = await useFetch<EventsResponse>('/api/events/list', {
  query: {
    search: debouncedSearch,
    filter: selectedFilter,
    page,
    pageSize: PAGE_SIZE,
  },
  watch: [debouncedSearch, selectedFilter, page],
})

watch(data, (val) => {
  if (val && val.totalPages > 0 && page.value > val.totalPages) {
    page.value = val.totalPages
  }
})

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

const events = computed(() => data.value?.events ?? [])
const totalEvents = computed(() => data.value?.total ?? 0)

const colorMode = useColorMode()
const paginationActiveBgColor = computed(() => (colorMode.value === 'dark' ? 'gray-700' : 'gray-200'))

const filters = computed(() => [
  { label: `ALL (${data.value?.counts.all ?? 0})`, value: 'ALL' as const },
  { label: 'PAST', value: 'PAST' as const },
])
</script>

<template>
  <div class="mt-20 overflow-x-hidden pb-20">
    <div class="w-full max-w-(--ui-container) mx-auto min-h-[calc(100vh-4.75rem)] flex flex-col">
      <!-- Header -->
      <div class="mx-10">
        <h1 class="text-2xl font-normal">
          <span class="font-light text-gray-500 dark:text-gray-400">Events</span>
          <br>
          <span class="text-[var(--color-brand9)] dark:text-[var(--color-brand8)] font-bold">Page</span>
        </h1>

        <!-- Search -->
        <UInput
          v-model="search"
          placeholder="Search events..."
          class="w-full my-5 font-normal"
          icon="i-lucide-search"
        />

        <!-- Filters -->
        <div class="w-full flex gap-2">
          <SectionButton
            v-for="filter in filters"
            :key="filter.value"
            :label="filter.label"
            :selected="selectedFilter === filter.value"
            @click="selectedFilter = filter.value"
          />
        </div>
      </div>

      <!-- Backdrop -->
      <div class="w-screen relative left-1/2 right-1/2 -mx-[50vw] bg-gray-50 dark:bg-gray-900 flex-1 min-h-0 mt-7 rounded-4xl">
        <div class="w-full max-w-(--ui-container) mx-auto px-4 sm:px-10 pt-5 pb-10 h-full flex flex-col">
          <div class="w-full flex-1 min-h-0 overflow-y-auto">
            <div
              v-if="showLoadingScreen"
              class="flex items-center justify-center py-16"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="animate-spin text-3xl text-gray-400 dark:text-gray-500"
              />
            </div>

            <div
              v-else-if="error"
              class="flex flex-col items-center justify-center text-center py-16 px-6"
            >
              <p class="text-sm text-red-400 dark:text-red-400">
                Something went wrong loading events.
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

            <div
              v-else
              class="flex flex-col gap-3"
            >
              <SecondaryEventCard
                v-for="item in events"
                :id="item.id"
                :key="item.id"
                :url="item.url"
                :title="item.title"
                :image="item.image"
                :start-time="item.startTime"
                :location="item.location"
                size="lg"
                :show-actions="false"
              />
            </div>

            <div
              v-if="!showLoadingScreen && !error && events.length === 0"
              class="flex flex-col items-center justify-center text-center py-16 px-6"
            >
              <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
                No events found.
              </p>
            </div>
          </div>

          <div class="w-full flex justify-center pt-4">
            <UPagination
              v-model:page="page"
              :items-per-page="PAGE_SIZE"
              :total="totalEvents"
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
