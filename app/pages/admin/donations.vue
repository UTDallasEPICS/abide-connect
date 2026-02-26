<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'secondary',
})
const funds = ref([
{
    id: 1,
    name: "Prenatal Care",
    startDate: "1/1/26",
    endDate: "1/1/27",
    image: "/images/image1.jpeg"
},
{
    id: 2,
    name: "Postpartum Care",
    startDate: "1/1/26",
    endDate: "1/1/27",
    image: "/images/image1.jpeg"
},
{
    id: 3,
    name: "Childbirth Education",
    startDate: "1/1/26",
    endDate: "1/1/27",
    image: "/images/image1.jpeg"
},
{
    id: 4,
    name: "Mobile Clinic",
    startDate: "1/1/26",
    endDate: "1/1/27",
    image: "/images/image1.jpeg"
},

])
</script>
<template>
    <div class="flex flex-col w-screen min-h-screen bg-slate-50 items-stretch pb-20">
        <!-- Header for KPI -->
        <div class="px-6 mt-20">
            <h1 class="text-3xl font-bold text-[#313131]">Donation Funds</h1>
        </div>
        <div class="px-6 mt-4 justify-end">
            <button
                class="grid place-items-center rounded-xl h-9 w-9 
                border border-gray-800/70
                hover:bg-gray-100/70 
                transition duration-200"
            >
            <UIcon name="i-heroicons-plus" class="w-5 h-5" />
            </button>
        </div>
        <!--Funds Layout-->
        <div class="px-6 mt-8">
            <div class="grid grid-cols-2 gap-6">
                <div
                    v-for="fund in funds"
                    :key="fund.id"
                    class="rounded-xl shadow-lg overflow-hidden hover:scale-95 transition-all duration-300 cursor-pointer">

                    <!-- Fund Image -->
                    <div class="h-35 relative overflow-hidden">
                        <img
                        :src="fund.image"
                        :alt="fund.name"
                        class="w-full h-full object-cover"
                        >
                    </div>
                    <!-- Fund  Content -->
                    <div class="p-2">
                        <h4 class="text-sm font_semibold text-brand4 mb-1.5"> {{ fund.name }}</h4>
                    <div class="space-y-2">
                    <!--Date Range-->
                    <div class="flex items-center text-gray-600 text-[12px]">
                    <svg class="w-4 h-4 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>{{fund.startDate }} - {{ fund.endDate }}</span>
                </div>
              </div>
            </div>
        </div>
        </div>
    </div>
    </div>
</template>