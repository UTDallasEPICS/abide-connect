<script setup lang="ts">
import 'vue3-carousel/dist/carousel.css'
import { Carousel, Slide, Pagination, Navigation } from 'vue3-carousel'

const carouselConfig = {
  itemsToShow: 1,
  wrapAround: true,
  mouseDrag: true,
  touchDrag: true,
  autoplay: 6000,
}
const slides = [
  { id: 1, src: '/images/image1.jpeg', alt: 'Slide 1' },
  { id: 2, src: '/images/image1.jpeg', alt: 'Slide 2' },
  { id: 3, src: '/images/image1.jpeg', alt: 'Slide 3' },
  { id: 4, src: '/images/image1.jpeg', alt: 'Slide 4' },
]
const events = [
  { id: 1, name: "Event 1" },
  { id: 2, name: "Event 2" },
  { id: 3, name: "Event 3" },
  { id: 4, name: "Event 4" },
];
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex justify-center py-6">
    <!-- Phone container -->
    <div class="w-[375px] bg-white rounded-3xl shadow-lg overflow-hidden flex flex-col">
      
      <!-- Top bar -->
      <div class="flex justify-between items-center p-4">
        <button><span class="text-2xl">⚙️</span></button>
        <span class="text-gray-400 text-sm">Home</span>
        <button><span class="text-2xl">📦</span></button>
      </div>

      <!-- Hero / Carousel Section -->
      <div class="bg-teal-700 py-3">
        <Carousel v-bind="carouselConfig">
          <Slide v-for="slide in slides" :key="slide.id">
            <img
              :src="slide.src"
              :alt="slide.alt"
              class="w-full h-48 object-cover"
            />
          </Slide>

          <template #addons>
            <!--<Navigation />-->
            <Pagination />
          </template>
        </Carousel>
      </div>

      <!-- Services -->
      <div class="p-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-rose-400 text-white rounded-lg flex items-center justify-center py-6">
            Service 3
          </div>
          <div class="bg-rose-400 text-white rounded-lg flex items-center justify-center py-6">
            Service 4
          </div>
        </div>
      </div>

      <!-- Upcoming Events -->
      <div class="px-4">
        <h3 class="text-lg font-semibold text-teal-700 mb-2">Upcoming Events</h3>
        <div class="grid grid-cols-2 gap-4">
          <div v-for="event in events" :key="event.id" 
               class="bg-teal-700 text-white rounded-lg flex items-center justify-center py-6">
            {{ event.name }}
          </div>
        </div>
      </div>

      <!-- Volunteer Sign Up -->
      <div class="mt-auto bg-rose-700 text-center py-4">
        <p class="text-white font-medium">Become A Volunteer</p>
        <button class="mt-2 bg-white text-rose-700 font-semibold px-6 py-2 rounded-full">
          Sign Up
        </button>
      </div>

      <!-- Bottom nav dots -->
      <div class="flex justify-around items-center py-3 border-t mt-6">
        <span class="w-4 h-4 rounded-full bg-black"></span>
        <span class="w-4 h-4 rounded-full border border-black"></span>
        <span class="w-4 h-4 rounded-full border border-black"></span>
        <span class="w-4 h-4 rounded-full border border-black"></span>
      </div>
    </div>
  </div>
</template>
