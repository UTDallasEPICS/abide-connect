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
  { id: 1, 
    name: "Event 1",
    date: "October 07, 2025",
    location: "Location 1",
    image: "/images/image1.jpeg"
  },
  { id: 2, 
    name: "Event 2",
    date: "October 15, 2025",
    location: "Location 2",
    image: "/images/image1.jpeg"
  },
  { id: 3,
    name: "Event 3",
    date: "November 03, 2025",
    location: "Location 3",
    image: "/images/image1.jpeg"
  },
  { id: 4, 
    name: "Event 4",
    date: "November 20, 2025",
    location: "Location 4",
    image: "/images/image1.jpeg"
  },
];

const handleSignUp = () => {
  alert('coming soon')
}

const services = [
  {
    id: 1,
    name: "Prenatal Care",
    image: "/images/image1.jpeg",
    href: "https://www.abidewomen.org/prenatalcare"
  },
  {
    id: 2,
    name: "Postpatrun Care",
    image: "/images/image1.jpeg",
    href: "https://www.abidewomen.org/postpartumcare"
  },
  {
    id: 3,
    name: "Childbirth Education",
    image: "/images/image1.jpeg",
    href: "https://www.abidewomen.org/childbirthed"
  },
  {
    id: 4,
    name: "Mobile Clinic",
    image: "/images/image1.jpeg",
    href: "https://www.abidewomen.org/mobile-clinic"
  },
]

</script>

<template>
  <div class="min-h-screen bg-gray-100 flex justify-center py-6">
    <!-- Phone container -->
    <div class="w-[375px] bg-white rounded-3xl shadow-lg overflow-hidden flex flex-col max-h-[812px] overflow-y-auto">
      
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

      <!-- Upcoming Events -->
      <div class="px-2 pb-4 pt-4">
        <h3 class="text-2xl font-semibold text-teal-700 mb-4">UPCOMING EVENTS</h3>
        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <div v-for="event in events" :key="event.id" 
               class="flex-shrink-0 w-[160px] rounded-xl shadow-lg overflow-hidden hover:scale-95 transition-all duration-300 cursor-pointer">

              <!-- Event Image Placeholder-->
              <div class="h-35 relative overflow-hidden">
                <img
                  :src="event.image"
                  :alt="event.name"
                  class="w-full h-full object-cover"
                />
              </div>
              
              <!-- Event Content -->
              <div class="p-2">
                <h4 class="text-sm font_semibold text-teal-800 mb-1.5"> {{ event.name }}</h4>
              <div class="space-y-2">
                <!--Date-->
                <div class="flex items-center text-gray-600 text-[12px]">
                  <svg class="w-4 h-4 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>{{ event.date }}</span>
                </div>
                
                <!--Location-->
                <div class="flex items-start text-gray-600 text-[10px]">
                  <svg class="w-3 h-3 mr-2 ml-0.5 mt-0.5 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span class="leading-tight"> {{ event.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Volunteer Sign Up -->
      <div class="bg-gradient-to-br from-rose-700 to-rose-800 text-center py-3 px-4 relative overflow-hidden items-center justify-center min-h-[100px]">

          <p class="text-white font-bold text-lg mb-1 ">Become A Volunteer</p>
          <!-- Sign up Button -->
          <button 
            @click="handleSignUp"
            class="group relative bg-white text-rose-700 font-bold px-7 py-2 rounded-full shadow-lg hover:shadow-2xl transition-transform hover:scale-105 active:scale-100 duration-300 overflow-hidden"
            >
            <span class="absolute inset-0 z-0 opacity-0 scale-95 rounded-full group-hover:opacity-100 group-hover:scale-100 transition-transform duration-300 bg-rose-50"></span>
              <span class="relative z-10 flex items-center justify-center gap-1 text-lg">
              <span>Sign Up</span>
              <svg 
                class="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="3"
                >
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H5"/>
              </svg>
            </span>
          </button>
      </div>
      <!-- Services -->
      <div class="px-2 pb-4 pt-4">
        <h3 class="text-2xl font-semibold text-teal-700 mb-4">SERVICES</h3>
        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          <a 
            v-for="service in services" 
            :key="service.id" 
            :href="service.href"
            target="_blank"
            rel="noopener noreferrer"

            class="flex-shrink-0 w-[190px] rounded-xl shadow-lg overflow-hidden hover:scale-95 transition-all duration-300 cursor-pointer">
            <div class="h-35 relative overflow-hidden">
              <img
                :src="service.image"
                :alt="service.name"
                class="w-full h-full object-cover transition-transform duration-300"
              />
              <div class="absolute inset-x-0 bottom-0 w-full bg-gradient-to-t from-black/60 to-transparent p-2">
                <p class="text-white text-sm font-semibold truncate" >{{ service.name }}</p>
              </div>
            </div>
          </a>
        </div>
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
