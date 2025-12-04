<script setup lang="ts">
import type { AdminFeature } from "~/types/admin/admin-dash.type"

const features: AdminFeature[] = [
    {
        id: 'events',
        label: 'Events Management',
        description: 'Create and manage event',
        icon: 'i-heroicons-calendar',
        iconBg: 'bg-[#3a696e]',
        bg: 'bg-gradient-to-br from-[#d3e2e4] to-white'

    },
    {
        id: 'training',
        label: 'Training Certificates',
        description: "Approve pending volunteer certificates",
        icon: 'i-heroicons-trophy',
        iconBg: 'bg-[#a26b60]',
        bg: 'bg-gradient-to-br from-[#F4E8E7] to-white'
    },
    {
        id: 'donations',
        label: 'Donations',
        description: 'Track and manage donations',
        icon: 'i-heroicons-currency-dollar',
        iconBg: 'bg-[#6b5745]',
        bg: 'bg-gradient-to-br from-[#e6d6c3] to-white'
    },
    {
        id: 'time-log',
        label: 'Volunteer Time Log',
        description: 'Approve and manage volunteer time log',
        icon: 'i-heroicons-clock',
        iconBg: 'bg-[#a4123f]',
        bg: 'bg-gradient-to-br from-[#f4d3e0] to-white'
    }
]

//KPI data for top cards
const kpis = [
    { 
        id: 'total-volunteers',
        label: 'Total Volunteers',
        value: '248',
        icon: 'i-heroicons-user-group'
    },
    {
        id: 'pending-certificates',
        label: 'Pending Certificates',
        value: '5',
        icon: 'i-heroicons-document-text'
    },
    {
        id: 'total-donations',
        label: 'Total Donations',
        value: '$10,000',
        icon: 'i-heroicons-currency-dollar'
    },
    {
        id: 'pending-timelog',
        label: 'Pending Time Log',
        value: '3',
        icon: 'i-heroicons-clock'
    }
]

</script>

<template>
    <div class="flex flex-col w-screen min-h-screen bg-slate-50 items-stretch pb-20">
        <!-- Header for KPI -->
        <div class="px-6 mt-20">
            <h1 class="text-3xl font-bold text-[#313131]">Welcome back, Admin!</h1>
        </div>
        <!-- KPI section -->
        <section class="px-6 mt-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
                v-for="kpi in kpis"
                :key="kpi.id"
                class="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
            >
                <div class="flex items-start justify-between mb-4">
                    <div 
                        class="flex rounded-xl h-12 w-12 p-2 shadow-md">
                        <UIcon :name="kpi.icon" class="w-8 h-8 text-black" />
                    </div>
                </div>
                
                <div class="space-y-1">
                    <p class="text-sm font-medium text-slate-600">{{ kpi.label }}</p>
                    <h3 class="text-3xl font-bold text-[#313131]">{{ kpi.value }}</h3>
                    <div class="flex items-center gap-2 text-sm">
                    </div>
                </div>
            </div>
        </section>
        <USeparator class="mt-10"/>
        <!-- Features section -->
        <section class="px-6 mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <UButton
            v-for="feature in features"
            :key="feature.id"
            class="group flex h-40 flex-col p-4 items-start justify-between rounded-3xl border-2 border-slate-200 text-left shadow-xs
                    transition-all duration-300 hover:shadow-xl hover:border-slate-250" 
            >
                <div 
                    :class="feature.iconBg"
                    class="flex rounded-xl h-10 w-10 p-1.5 shadow-lg transition-transform duration-300 group-hover:scale-105">
                <UIcon :name="feature.icon" class="w-7 h-7 text-white" />
                </div>
                <span class="text-lg font-bold tracking-wide text-[#313131]">
                    {{ feature.label }}
                </span>

                <span 
                    v-if="feature.description"
                    class=" text-[11px] leading-tight text-slate-700">
                    {{ feature.description }}
                </span>
                <div class="flex text-[#3a696e] font-medium text-sm">
                    <span class="transition-transform duration-300 group-hover:translate-x-1">
                        Manage →
                    </span>
                </div>
            </UButton>
        
        </section>
    </div>
</template>