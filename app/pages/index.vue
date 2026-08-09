<script setup lang="ts">
import ServiceComponent from '~/components/homepage/ServiceComponent.vue';
import EventCard from '~/components/event/EventCard.vue';
import EventCardSkeleton from '~/components/homepage/EventCardSkeleton.vue';
import WeekCalender from '~/components/homepage/WeekCalender.vue';

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
}

const skeletonCount = 6

const onSignUpClick = () => navigateTo('/sign-up');
const onSeeAllEventsClick = () => navigateTo('/events');

// Own pending state, true from the very first render — no flash.
const pending = ref(true)
const error = ref(false)

const { data: upcomingEvents, error: fetchError, status } = useLazyFetch<UpcomingEvent[]>('/api/events/upcoming', {
  query: { limit: 9 },
  default: () => [],
  server: false,
})

// status goes 'idle' -> 'pending' -> 'success' | 'error'
watch(status, (newStatus) => {
  if (newStatus === 'success' || newStatus === 'error') {
    pending.value = false
    error.value = newStatus === 'error'
    if (newStatus === 'error') {
      console.error('Failed to load events:', fetchError.value)
    }
  }
})

const headers = useRequestHeaders(['cookie']);
const { data: user } = await useFetch('/api/user/me', { headers })
</script>
<template>
  <div class="mt-20 min-h-screen pb-50">
    <div class="w-full max-w-(--ui-container) mx-auto">
      <div class="lg:px-10 px-5">
        <!-- Carousel -->
        <UCarousel
            loop
            dots
            class="rounded-2xl shadow-xl overflow-hidden mb-7"
            :autoplay="{ delay: 6000 }"
            v-slot="{ item }"
            :items="items"
            :ui="{
                dots: 'bottom-3 gap-1.5',
                dot: 'w-2 h-2 bg-black/30 data-[state=active]:bg-white transition-colors shadow-lg',
            }"
        >
            <img :src="item" class="w-full aspect-video object-cover rounded-2xl" alt="">
        </UCarousel>

          <h3 class="uppercase font-gray-900 mb-2 ">Your Event Calender</h3>
          <WeekCalender
            v-model="selectedDate"
            :is-date-disabled="isDateDisabled"
            locale="en-US"
            weekday-format="short"
            :first-day-of-week="0"
            class="rounded-2xl"
          />

        <!-- Upcoming Events -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="uppercase font-gray-900">Upcomming Events</h3>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            class="flex items-center gap-1.5 rounded-full bg-transparent px-3.5 py-1.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
            @click="onSeeAllEventsClick"
          >
            <UIcon name="i-lucide-search" class="w-4 h-4" />
            <span>See All</span>
          </UButton>
        </div>

        <!-- Loading skeleton -->
        <div v-if="pending" class="flex gap-4 overflow-x-hidden mb-4">
          <EventCardSkeleton v-for="n in skeletonCount" :key="n" />
        </div>
        <p v-if="error" class="text-red-600 text-sm mb-4">
          Failed to load events. Please try again later.
        </p>

        <!-- Loaded events -->
        <UCarousel
          v-if="!pending"
          drag-free
          :items="upcomingEvents"
          class="mb-4 min-h-30"
          :ui="{
            viewport: 'overflow-visible lg:overflow-x-hidden',
            container: 'gap-1',
            item: 'basis-auto',
          }"
          v-slot="{ item }"
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
      </div>
    </div>

    <!-- Sign Up — only shown when there is no signed-in user -->
    <div
      v-if="!user"
      class="w-full h-30 font-normal text-white bg-rose-800 flex flex-col items-center justify-center gap-2 px-4 text-center my-5"
    >
        <span>Sign up to be a volunteer.</span>
        <UButton
          label="Sign Up"
          color="white"
          trailing-icon="i-heroicons-arrow-right-20-solid"
          class="bg-white text-rose-800 hover:bg-white/90 font-bold rounded-full"
          @click="onSignUpClick"
        />
    </div>

    <div class="w-full max-w-(--ui-container) mx-auto">
      <div class="lg:px-10 px-5">
        <h3 class="uppercase font-gray-900 mb-3">Services</h3>
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
      </div>
    </div>
  </div>
</template>