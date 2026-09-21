<script setup lang="ts">
import ServiceComponent from '~/components/homepage/ServiceComponent.vue'
import EventCard from '~/components/event/EventCard.vue'
import SecondaryEventCard from '~/components/event/SecondaryEventCard.vue'
import EventCardSkeleton from '~/components/homepage/EventCardSkeleton.vue'
import SecondaryEventCardSkeleton from '~/components/event/SecondaryEventCardSkeleton.vue'
import ConfirmModal from '~/components/modals/ConfirmModal.vue'

const items = [
  '/images/image2.jpg',
  '/images/image1.png',
  '/images/image3.JPG',
]

interface UpcomingEvent {
  id: string
  title: string
  url: string
  image: string
  day: string
  month: string
  location: string
  going: number
  startTime: string
}

interface UserUpcomingEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  address: string | null
  isTraining: boolean
  isVolunteer: boolean
  imageUrl: string | null
}

interface VolunteerMe {
  id: string
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
}

const oneRowMinHeight = 'min-h-24'

const skeletonCount = 6

const onSignUpClick = () => navigateTo('/auth/sign-up')
const onSeeAllEventsClick = () => navigateTo('/events/list')
const onVolunteerApplicationClick = () => navigateTo('/volunteer-application')

// Both of these run client-side only (`server: false`). Nothing else on this
// page reads the session during SSR, so that keeps the rendered HTML identical
// for a signed-in and a signed-out visitor — which is what lets `'/'` be cached
// with `swr` in nuxt.config.ts. Move either one back to the server and the
// cache starts handing a signed-in page to anonymous visitors.
//
// The cost is that the "Your Events" section and the sign-up strip below it
// appear after hydration rather than in the first paint. The `immediate: false`
// + watch pattern on the dependent fetches already handles arriving late.
const { data: user } = useLazyFetch('/api/user/me', { server: false })
const { data: volunteer } = useLazyFetch<VolunteerMe | null>('/api/volunteer/me', { server: false })

const showYourEventsSection = computed(() => !!user.value)

const yourEventsPending = ref(true)
const yourEventsError = ref(false)

const {
  data: yourEventsRaw,
  error: yourEventsFetchError,
  status: yourEventsStatus,
} = useLazyFetch<UserUpcomingEvent[]>('/api/user/upcoming-events', {
  // Explicit key so the `refreshNuxtData` calls below actually find this
  // fetch. Without one, useFetch keys itself on a hash of the URL and its
  // options ("$f" + hash(...)), which no caller can spell — and since `user`
  // now resolves client-side, `immediate` is always false on first render and
  // the watch is the only thing that ever starts this request.
  key: '/api/user/upcoming-events',
  default: () => [],
  server: false,
  immediate: showYourEventsSection.value,
})

watch(yourEventsStatus, (newStatus) => {
  if (newStatus === 'success' || newStatus === 'error') {
    yourEventsPending.value = false
    yourEventsError.value = newStatus === 'error'
    if (newStatus === 'error') {
      console.error('Failed to load your events:', yourEventsFetchError.value)
    }
  }
})

watch(showYourEventsSection, (shouldShow) => {
  if (shouldShow && yourEventsStatus.value === 'idle') {
    yourEventsPending.value = true
    void refreshNuxtData('/api/user/upcoming-events')
  }
}, { immediate: true })

const yourEvents = computed(() => yourEventsRaw.value.map(e => ({
  id: e.id,
  title: e.title,
  url: `/events/${e.id}`,
  image: e.imageUrl
    ? `/api/events/${e.id}/images/${e.imageUrl.split('/').pop()}`
    : '/images/default-event.jpg',
  startTime: e.startTime,
  location: e.address ?? '',
})))

// Whether the "Your Events" section (header included) should render at all:
// signed in, and either still loading (don't know yet) or loaded with items.
// Once loaded with zero items, the whole section disappears — no header,
// no empty-state text.
const showYourEventsBlock = computed(() =>
  showYourEventsSection.value && (yourEventsPending.value || yourEventsError.value || yourEvents.value.length > 0),
)

// --- Cancel RSVP confirmation modal ---
const cancelModalOpen = ref(false)
const cancelLoading = ref(false)
const cancelError = ref<string | null>(null)
const pendingCancelId = ref<string | null>(null)
const pendingCancelTitle = computed(() => {
  const match = yourEvents.value.find(e => e.id === pendingCancelId.value)
  return match?.title ?? 'this event'
})

function handleCancelRsvp(eventId: string) {
  pendingCancelId.value = eventId
  cancelError.value = null
  cancelModalOpen.value = true
}

function handleCancelModalOpenUpdate(value: boolean) {
  cancelModalOpen.value = value
  if (!value) {
    pendingCancelId.value = null
    cancelError.value = null
  }
}

async function confirmCancelRsvp() {
  if (!pendingCancelId.value) return
  cancelLoading.value = true
  cancelError.value = null
  try {
    await $fetch(`/api/events/${pendingCancelId.value}/rsvp`, { method: 'DELETE', body: {} })
    cancelModalOpen.value = false
    pendingCancelId.value = null
    await refreshNuxtData('/api/user/upcoming-events')
  }
  catch (err) {
    console.error('Failed to cancel RSVP:', err)
    cancelError.value = 'Something went wrong. Please try again.'
  }
  finally {
    cancelLoading.value = false
  }
}

// --- Upcoming Events ---
const pending = ref(true)
const error = ref(false)

const { data: upcomingEvents, error: fetchError, status } = useLazyFetch<UpcomingEvent[]>('/api/events/upcoming', {
  query: { limit: 9 },
  default: () => [],
  server: false,
})

watch(status, (newStatus) => {
  if (newStatus === 'success' || newStatus === 'error') {
    pending.value = false
    error.value = newStatus === 'error'
    if (newStatus === 'error') {
      console.error('Failed to load events:', fetchError.value)
    }
  }
})

// --- Training Events (volunteers who aren't approved yet) ---
const showTrainingSection = computed(() => !!volunteer.value && volunteer.value.approvalStatus !== 'APPROVED')

const trainingPending = ref(true)
const trainingError = ref(false)

const {
  data: trainingEvents,
  error: trainingFetchError,
  status: trainingStatus,
} = useLazyFetch<UpcomingEvent[]>('/api/events/training', {
  // See the note on the "Your Events" fetch above — the watch below refreshes
  // by this key, so it has to be set explicitly.
  key: '/api/events/training',
  query: { limit: 9 },
  default: () => [],
  server: false,
  immediate: showTrainingSection.value,
})

watch(trainingStatus, (newStatus) => {
  if (newStatus === 'success' || newStatus === 'error') {
    trainingPending.value = false
    trainingError.value = newStatus === 'error'
    if (newStatus === 'error') {
      console.error('Failed to load training events:', trainingFetchError.value)
    }
  }
})

watch(showTrainingSection, (shouldShow) => {
  if (shouldShow && trainingStatus.value === 'idle') {
    trainingPending.value = true
    void refreshNuxtData('/api/events/training')
  }
}, { immediate: true })
</script>

<template>
  <div>
    <PageContainer>
      <!-- Carousel -->
      <UCarousel
        v-slot="{ item, index }"
        loop
        dots
        class="rounded-2xl shadow-xl overflow-hidden mb-8"
        :autoplay="{ delay: 6000 }"
        :items="items"
        :ui="{
          dots: 'bottom-3 gap-1.5',
          dot: 'w-2 h-2 bg-black/30 data-[state=active]:bg-white transition-colors shadow-lg',
        }"
      >
        <!--
          The originals are 1–2 MP PNG/JPEG (image3.JPG is 4032x3024, 2.3 MB).
          NuxtImg re-encodes to webp at the width actually needed. Only the
          first slide is the LCP candidate, so it loads eagerly at high
          priority and the rest stay lazy — the carousel doesn't advance for
          6 seconds.
        -->
        <NuxtImg
          :src="item"
          :width="1600"
          :height="900"
          format="webp"
          sizes="xs:100vw sm:640px md:768px lg:1024px xl:1280px"
          :loading="index === 0 ? 'eager' : 'lazy'"
          :fetchpriority="index === 0 ? 'high' : 'auto'"
          :preload="index === 0"
          decoding="async"
          class="w-full aspect-video object-cover rounded-2xl"
          alt=""
        />
      </UCarousel>

      <!-- Your Events — hidden entirely once loaded with zero events -->
      <section
        v-if="showYourEventsBlock"
        class="mb-8"
      >
        <div class="flex items-center justify-between mb-2">
          <div
            v-if="yourEventsPending"
            class="h-5 w-32 animate-pulse rounded bg-gray-200"
          />
          <h3
            v-else
            class="uppercase font-gray-900"
          >
            Your Events
          </h3>
        </div>

        <div :class="oneRowMinHeight">
          <div
            v-if="yourEventsPending"
            class="flex flex-col gap-3"
          >
            <SecondaryEventCardSkeleton
              v-for="n in 1"
              :key="n"
            />
          </div>
          <p
            v-if="yourEventsError"
            class="text-red-600 text-sm"
          >
            Failed to load your events. Please try again later.
          </p>

          <template v-if="!yourEventsPending && !yourEventsError">
            <div class="flex flex-col gap-3">
              <SecondaryEventCard
                v-for="item in yourEvents"
                :id="item.id"
                :key="item.id"
                :url="item.url"
                :title="item.title"
                :image="item.image"
                :start-time="item.startTime"
                :location="item.location"
                @cancel="handleCancelRsvp"
              />
            </div>
          </template>
        </div>
      </section>

      <!-- Upcoming Events -->
      <section class="mb-8">
        <div class="flex items-center justify-between mb-2">
          <div
            v-if="pending"
            class="h-5 w-40 animate-pulse rounded bg-gray-200"
          />
          <h3
            v-else
            class="uppercase font-gray-900"
          >
            Upcomming Events
          </h3>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            class="flex items-center gap-1.5 rounded-full bg-transparent px-3.5 py-1.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            @click="onSeeAllEventsClick"
          >
            <UIcon
              name="i-lucide-search"
              class="w-4 h-4"
            />
            <span>See All</span>
          </UButton>
        </div>

        <div :class="oneRowMinHeight">
          <div
            v-if="pending"
            class="flex gap-4 overflow-x-hidden"
          >
            <EventCardSkeleton
              v-for="n in skeletonCount"
              :key="n"
            />
          </div>
          <p
            v-if="error"
            class="text-red-600 text-sm"
          >
            Failed to load events. Please try again later.
          </p>

          <template v-if="!pending && !error">
            <UCarousel
              v-if="upcomingEvents.length"
              v-slot="{ item }"
              drag-free
              :items="upcomingEvents"
              :ui="{
                viewport: 'overflow-visible lg:overflow-x-hidden',
                container: 'gap-1',
                item: 'basis-auto',
              }"
            >
              <EventCard
                :url="item.url"
                :title="item.title"
                :image="item.image"
                :day="item.day"
                :month="item.month"
                :location="item.location"
                :going="item.going"
              />
            </UCarousel>
            <p
              v-else
              class="text-gray-400 font-normal"
            >
              No events found
            </p>
          </template>
        </div>
      </section>

      <!-- Training Events -->
      <section
        v-if="showTrainingSection"
        class="mb-8"
      >
        <div class="flex items-center justify-between mb-2">
          <div
            v-if="trainingPending"
            class="h-5 w-36 animate-pulse rounded bg-gray-200"
          />
          <h3
            v-else
            class="uppercase font-gray-900"
          >
            Training Events
          </h3>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            class="flex items-center gap-1.5 rounded-full bg-transparent px-3.5 py-1.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            @click="onSeeAllEventsClick"
          >
            <UIcon
              name="i-lucide-search"
              class="w-4 h-4"
            />
            <span>See All</span>
          </UButton>
        </div>

        <div :class="oneRowMinHeight">
          <div
            v-if="trainingPending"
            class="flex gap-4 overflow-x-hidden"
          >
            <EventCardSkeleton
              v-for="n in skeletonCount"
              :key="n"
            />
          </div>
          <p
            v-if="trainingError"
            class="text-red-600 text-sm"
          >
            Failed to load training events. Please try again later.
          </p>

          <template v-if="!trainingPending && !trainingError">
            <UCarousel
              v-if="trainingEvents.length"
              v-slot="{ item }"
              drag-free
              :items="trainingEvents"
              :ui="{
                viewport: 'overflow-visible lg:overflow-x-hidden',
                container: 'gap-1',
                item: 'basis-auto',
              }"
            >
              <EventCard
                :url="item.url"
                :title="item.title"
                :image="item.image"
                :day="item.day"
                :month="item.month"
                :location="item.location"
                :going="item.going"
              />
            </UCarousel>
            <p
              v-else
              class="text-gray-400 font-normal"
            >
              No events found
            </p>
          </template>
        </div>
      </section>
    </PageContainer>

    <!-- Sign Up -->
    <div
      v-if="!user"
      class="w-full h-30 font-normal text-white bg-rose-900 flex flex-col items-center justify-center gap-2 px-4 text-center mb-8"
    >
      <span>Sign up to be a volunteer.</span>
      <UButton
        label="Sign Up"
        color="white"
        trailing-icon="i-heroicons-arrow-right-20-solid"
        class="bg-white text-rose-900 hover:bg-white/90 font-bold rounded-full"
        @click="onSignUpClick"
      />
    </div>

    <!-- Volunteer Application -->
    <div
      v-if="user && !volunteer"
      class="w-full h-30 font-normal text-white bg-rose-900 flex flex-col items-center justify-center gap-2 px-4 text-center mb-8"
    >
      <span>Want to volunteer? Submit the volunteer form.</span>
      <UButton
        label="Submit Now"
        color="white"
        trailing-icon="i-heroicons-arrow-right-20-solid"
        class="bg-white text-rose-900 hover:bg-white/90 font-bold rounded-full"
        @click="onVolunteerApplicationClick"
      />
    </div>

    <PageContainer>
      <section>
        <h3 class="uppercase font-gray-900 mb-4">
          Services
        </h3>
        <div class="flex flex-col gap-4 sm:flex-row sm:gap-5">
          <ServiceComponent
            title="Prenatal Care"
            description="Experience comprehensive prenatal care tailored to your unique needs at our clinic, where you'll be supported by a bilingual team of women of color."
            footer-text="Learn more about prental care"
            image="/images/PrenatalCare.png"
            url="https://www.abidewomen.org/prenatalcare"
          />
          <ServiceComponent
            title="Postpartum Care and Doula Support"
            description="Experience compassionate postpartum care designed to support your recovery and well-being after childbirth."
            footer-text="Explore postpartum care"
            image="/images/PostpartumCare.png"
            url="https://www.abidewomen.org/postpartumcare"
          />
          <ServiceComponent
            title="Childbirth Education"
            description="Empower yourself with essential knowledge and skills for a healthy pregnancy, labor, and postpartum experience in our supportive, culturally-sensitive classes."
            footer-text="View upcoming class times"
            image="/images/ChildbirthEducation.png"
            url="https://www.abidewomen.org/childbirthed"
          />
          <ServiceComponent
            title="Donate"
            description="Every contribution to Abide Women's Health Services fuels our mission to enhance maternal and infant health outcomes in communities that face the lowest quality of care."
            footer-text="Give now"
            image="/images/Donate.png"
            url="https://www.abidewomen.org/donate"
          />
        </div>
      </section>
    </PageContainer>

    <!-- Unregister confirmation -->
    <ConfirmModal
      :open="cancelModalOpen"
      title="Unregister"
      :description="`Are you sure you want to unregister from ${pendingCancelTitle}?`"
      confirm-label="Unregister"
      confirm-color="error"
      :loading="cancelLoading"
      :error="cancelError"
      @update:open="handleCancelModalOpenUpdate"
      @confirm="confirmCancelRsvp"
    />
  </div>
</template>
