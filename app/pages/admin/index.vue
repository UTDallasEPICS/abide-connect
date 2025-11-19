<script setup lang="ts">
type AdminFeature = {
    id: string
    label: string
    description?: string
    icon: string
    iconBg: string
    bg: string
}

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
</script>

<template>
    <div class="flex flex-col w-screen min-h-screen bg-slate-50 items-stretch pb-20">
        <section class="mt-20 px-6">
            <div class="overflow-hidden rounded-3xl h-40 border border-slate-300 shadow-lg bg-slate-200">
                <div class="flex items-start justify-start text-left px-5 py-5 ">
                    <p class="text-2xl font-semibold text-[#313131] ">Welcome back!</p>
                </div>
            </div>
        </section>

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