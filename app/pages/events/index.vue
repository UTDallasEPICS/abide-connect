<script setup lang="ts">
import SecondaryEventCard from '~/components/event/SecondaryEventCard.vue';
import SecondaryEventCardSkeleton from '~/components/event/SecondaryEventCardSkeleton.vue';
import WeekCalendar from '~/components/WeekCalendar.vue';
import type { DateValue } from '@internationalized/date';
import { today } from '@internationalized/date';
import { ORG_TIME_ZONE } from '#shared/utils/timeZone';
import { addZonedDays, zonedParts } from '#shared/utils/reportRange';
import { zonedDateKey, zonedDayBounds } from '#shared/utils/eventTime';

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

// --- Upcoming Events Calendar ---
// The calendar runs on the org's clock, not the reader's: a highlighted day is
// a day an event falls on at the clinic, and "today" is today there.
const tz = ORG_TIME_ZONE;
const calendarDate = ref<DateValue>(today(tz));
const isDateDisabled = (d: DateValue) => d.toDate(tz) < zonedDayBounds(new Date()).start;

const {
  data: upcomingEvents,
  pending: upcomingPending,
  error: upcomingFetchError,
} = await useFetch<(UpcomingEvent & { endTime: string })[]>('/api/events/upcoming', {
  // 50 is the most the cached feed will honour (see server/utils/cacheKey.ts).
  query: { limit: 50 },
});
const upcomingError = computed(() => !!upcomingFetchError.value);

/** `YYYY-MM-DD` in the org's zone, the key the highlights are looked up by. */
const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// Every day an upcoming event falls on. An event marks each day it spans, not
// just its first — same walk as the calendar on /volunteer.
const eventDates = computed(() => {
  const days = new Set<string>();

  for (const event of upcomingEvents.value ?? []) {
    let cursor = zonedDayBounds(event.startTime).start;
    const last = zonedDayBounds(event.endTime ?? event.startTime).start;

    // Bounded so bad data (an endTime before its startTime, or a wildly long
    // range) can't hang the render.
    for (let i = 0; i < 366; i++) {
      const p = zonedParts(cursor);
      days.add(toDateKey(p.year, p.month, p.day));
      if (cursor >= last) break;
      cursor = addZonedDays(cursor, 1);
    }
  }

  return days;
});

const hasEventOn = (day: DateValue) => eventDates.value.has(toDateKey(day.year, day.month, day.day));

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
    <!-- Upcoming Events Calendar -->
    <section class="mb-8">
      <div class="flex items-center justify-between mb-2">
        <div v-if="upcomingPending" class="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <h3 v-else class="uppercase font-gray-900">Upcoming Events</h3>
      </div>

      <div v-if="upcomingPending" class="h-80 w-full animate-pulse rounded-2xl bg-gray-200" />
      <UCard v-else>
        <UCalendar
          v-model="calendarDate"
          color="brand4"
          :is-date-disabled="isDateDisabled"
          locale="en-US"
          weekday-format="short"
          :first-day-of-week="0"
          class="rounded-2xl"
        >
          <template #day="{ day }">
            <span
              v-if="hasEventOn(day)"
              class="absolute inset-0 flex items-center justify-center rounded-full font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300"
            >
              {{ day.day }}
              <span class="sr-only">, has events</span>
            </span>
            <template v-else>
              {{ day.day }}
            </template>
          </template>
        </UCalendar>

        <p v-if="upcomingError" class="pt-3 text-center text-sm text-red-400">
          Failed to load upcoming events.
        </p>
        <!-- Key for the shaded days; pointless when nothing is marked. -->
        <div
          v-else-if="eventDates.size"
          class="flex items-center justify-center gap-4 pt-3 text-xs text-gray-500 dark:text-gray-400"
        >
          <span class="flex items-center gap-1.5">
            <span class="size-3 rounded-full bg-sky-100 dark:bg-sky-900/50" />
            Event scheduled
          </span>
        </div>
        <p v-else class="pt-3 text-center text-sm text-gray-400">
          No upcoming events
        </p>
      </UCard>
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