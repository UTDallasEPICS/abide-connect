<script setup lang="ts">
import UpcomingEventCard from '~/components/event/UpcomingEventCard.vue';
import SecondaryEventCard from '~/components/event/SecondaryEventCard.vue';
import SecondaryEventCardSkeleton from '~/components/event/SecondaryEventCardSkeleton.vue';
import WeekCalendar from '~/components/WeekCalendar.vue';
import { zonedDateKey } from '#shared/utils/eventTime';

interface UpcomingEvent {
  id: string;
  title: string;
  url: string;
  image: string;
  day: string;
  month: string;
  location: string;
  going: number;
  startTime: string;
}

interface UserUpcomingEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  address: string | null;
  isTraining: boolean;
  isVolunteer: boolean;
  imageUrl: string | null;
}

function onSeeAllYourEventsClick() {
  navigateTo('/volunteer');
}

function onSeeAllWeekEventsClick() {
  navigateTo('/events/list');
}

// --- Events Today (also powers the carousel) ---
const {
  data: todayEvents,
  pending: todayPending,
  error: todayFetchError,
} = await useFetch<UpcomingEvent[]>('/api/events/today', {
  query: { limit: 20 },
});
const todayError = computed(() => !!todayFetchError.value);

// --- Your Events ---
const headers = useRequestHeaders(['cookie']);
const { data: user } = await useFetch('/api/user/me', { headers });

const showYourEventsSection = computed(() => !!user.value);

const yourEventsPending = ref(true);
const yourEventsError = ref(false);

const {
  data: yourEventsRaw,
  error: yourEventsFetchError,
  status: yourEventsStatus,
} = useLazyFetch<UserUpcomingEvent[]>('/api/user/upcoming-events', {
  default: () => [],
  server: false,
  immediate: showYourEventsSection.value,
});

watch(yourEventsStatus, (newStatus) => {
  if (newStatus === 'success' || newStatus === 'error') {
    yourEventsPending.value = false;
    yourEventsError.value = newStatus === 'error';
    if (newStatus === 'error') {
      console.error('Failed to load your events:', yourEventsFetchError.value);
    }
  }
});

watch(
  showYourEventsSection,
  (shouldShow) => {
    if (shouldShow && yourEventsStatus.value === 'idle') {
      yourEventsPending.value = true;
      void refreshNuxtData('/api/user/upcoming-events');
    }
  },
  { immediate: true }
);

const yourEvents = computed(() =>
  yourEventsRaw.value.map((e) => ({
    id: e.id,
    title: e.title,
    url: `/events/${e.id}`,
    image: e.imageUrl
      ? `/api/events/${e.id}/images/${e.imageUrl.split('/').pop()}`
      : '/images/default-event.jpg',
    startTime: e.startTime,
    location: e.address ?? '',
  }))
);

const showYourEventsBlock = computed(
  () =>
    showYourEventsSection.value &&
    (yourEventsPending.value || yourEventsError.value || yourEvents.value.length > 0)
);

// --- Cancel RSVP ---
function handleCancelRsvp(eventId: string) {
  navigateTo(`/events/${eventId}`);
}

// --- Events This Week ---
const {
  data: weekEvents,
  pending: weekPending,
  error: weekFetchError,
} = await useFetch<UpcomingEvent[]>('/api/events/week', {
  query: { limit: 20 },
});
const weekError = computed(() => !!weekFetchError.value);

// --- Week Calendar: selected day + events happening that day ---
const selectedDate = ref(new Date());

const { data: dayEvents, pending: dayEventsPending } = await useFetch<UpcomingEvent[]>(
  '/api/events/by-day',
  {
    // The org's calendar day, not the reader's: `/api/events/by-day` reads this
    // string in the same zone, and the two have to name the same day.
    query: computed(() => ({ date: zonedDateKey(selectedDate.value) })),
    watch: [selectedDate],
  }
);

</script>

<template>
  <PageContainer>
    <!-- Today's Events (carousel) -->
    <section class="mb-8">
      <div class="flex items-center justify-between mb-2">
        <div v-if="todayPending" class="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <h3 v-else class="uppercase font-gray-900">Today's Events</h3>
      </div>

      <!-- Loading skeleton -->
      <div v-if="todayPending" class="aspect-[21/9] w-full animate-pulse rounded-2xl bg-gray-200" />
      <!-- Error state -->
      <div
        v-else-if="todayError"
        class="flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-gray-50 text-sm text-red-400"
      >
        Failed to load today's events.
      </div>
      <!-- Empty state -->
      <div
        v-else-if="!todayEvents?.length"
        class="flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400"
      >
        No events today
      </div>
      <!-- Carousel -->
      <UCarousel
        v-else
        loop
        dots
        :items="todayEvents"
        :autoplay="{ delay: 6000 }"
        v-slot="{ item }"
        :ui="{
          dots: 'relative -mt-4 gap-1.5',
          dot: 'w-2 h-2 rounded-full bg-gray-300 data-[state=active]:bg-gray-900 transition-colors',
        }"
      >
        <UpcomingEventCard
          :url="item.url"
          :image="item.image"
          :day="item.day"
          :month="item.month"
          :title="item.title"
          :location="item.location"
        />
      </UCarousel>
    </section>

    <!-- Week Calendar (temporarily disabled) -->
    <section v-if="false" class="mb-8">
      <WeekCalendar v-model="selectedDate" />

      <!-- Events for the selected day -->
      <div class="mt-4 space-y-2">
        <div v-if="dayEventsPending" class="flex flex-col gap-3">
          <SecondaryEventCardSkeleton v-for="n in 3" :key="n" />
        </div>
        <div
          v-else-if="!dayEvents?.length"
          class="flex h-16 items-center justify-center rounded-2xl bg-gray-50 text-sm text-gray-400"
        >
          No events on this day
        </div>
        <SecondaryEventCard
          v-for="event in dayEvents"
          v-else
          :key="event.id"
          :id="event.id"
          :url="event.url"
          :image="event.image"
          :start-time="event.startTime"
          :title="event.title"
          :location="event.location"
          size="lg"
          :show-actions="false"
        />
      </div>
    </section>

    <!-- Your Events -->
    <section v-if="showYourEventsBlock" class="mb-8">
      <div class="flex items-center justify-between mb-2">
        <div v-if="yourEventsPending" class="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <h3 v-else class="uppercase font-gray-900">Your Events</h3>
        <UButton
          v-if="!yourEventsPending"
          color="neutral"
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5 rounded-full bg-transparent px-3.5 py-1.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
          @click="onSeeAllYourEventsClick"
        >
          <UIcon name="i-lucide-search" class="w-4 h-4" />
          <span>See All</span>
        </UButton>
      </div>

      <div v-if="yourEventsPending" class="flex flex-col gap-3">
        <SecondaryEventCardSkeleton v-for="n in 2" :key="n" />
      </div>
      <p v-else-if="yourEventsError" class="text-red-600 text-sm">
        Failed to load your events. Please try again later.
      </p>
      <div v-else class="flex flex-col gap-3">
        <SecondaryEventCard
          v-for="item in yourEvents"
          :key="item.id"
          :id="item.id"
          :url="item.url"
          :title="item.title"
          :image="item.image"
          :start-time="item.startTime"
          :location="item.location"
          @cancel="handleCancelRsvp"
        />
      </div>
    </section>


    <!-- Events This Week -->
    <section class="mb-8">
      <div class="flex items-center justify-between mb-2">
        <div v-if="weekPending" class="h-5 w-32 animate-pulse rounded bg-gray-200" />
        <h3 v-else class="uppercase font-gray-900">Events This Week</h3>
        <UButton
          v-if="!weekPending"
          color="neutral"
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5 rounded-full bg-transparent px-3.5 py-1.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
          @click="onSeeAllWeekEventsClick"
        >
          <UIcon name="i-lucide-search" class="w-4 h-4" />
          <span>See All</span>
        </UButton>
      </div>

      <div v-if="weekPending" class="flex flex-col gap-3">
        <SecondaryEventCardSkeleton v-for="n in 3" :key="n" />
      </div>
      <p v-else-if="weekError" class="text-red-600 text-sm">
        Failed to load this week's events. Please try again later.
      </p>
      <p v-else-if="!weekEvents?.length" class="text-gray-400 font-normal">
        No event this week
      </p>
      <div v-else class="flex flex-col gap-3">
        <SecondaryEventCard
          v-for="item in weekEvents"
          :key="item.id"
          :id="item.id"
          :url="item.url"
          :title="item.title"
          :image="item.image"
          :start-time="item.startTime"
          :location="item.location"
          :show-actions="false"
        />
      </div>
    </section>
  </PageContainer>
</template>