<script setup lang="ts">
import type { AdminFeature } from '~/types/admin/admin-dash.type'

/**
 * Admin dashboard: KPI tiles plus navigation into each management area.
 *
 * Reachable only with the `admin` role (`auth.global.ts`, `/admin` prefix).
 * Note the tiles link to `/events/manage`, which is guarded separately by its
 * own prefix — the dashboard isn't what protects it.
 *
 * Tile colours are hardcoded hex values in Tailwind arbitrary-value syntax
 * rather than the `brand*` palette, so they don't follow theme changes.
 */

const features: AdminFeature[] = [
  {
    id: 'events',
    to: '/events/manage',
    label: 'Events Management',
    description: 'Create and manage event',
    icon: 'i-heroicons-calendar',
    iconBg: 'bg-[#3a696e]',
    bg: 'bg-gradient-to-br from-[#d3e2e4] to-white',

  },
  {
    id: 'training',
    to: '/admin/training',
    label: 'Training Certificates',
    description: 'Approve pending volunteer certificates',
    icon: 'i-heroicons-trophy',
    iconBg: 'bg-[#a26b60]',
    bg: 'bg-gradient-to-br from-[#F4E8E7] to-white',
  },
  {
    id: 'member-management',
    to: '/admin/member-management',
    label: 'Member Management',
    description: 'View and manage members',
    icon: 'i-heroicons-users',
    iconBg: 'bg-[#6b5745]',
    bg: 'bg-gradient-to-br from-[#e6d6c3] to-white',
  },
  {
    id: 'time-log',
    to: '/admin/volunteer-logs',
    label: 'Volunteer Time Log',
    description: 'Approve and manage volunteer time log',
    icon: 'i-heroicons-clock',
    iconBg: 'bg-[#a4123f]',
    bg: 'bg-gradient-to-br from-[#f4d3e0] to-white',
  },
]

interface AdminStats {
  totalUsers: number
  activeVolunteers: number
  pendingCertificates: number
  pendingTimeLogs: number
}

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: stats } = await useFetch<AdminStats>('/api/admin/stats', { headers })

// KPI data for top cards
const kpis = computed(() => [
  {
    id: 'total-users',
    label: 'Total Users',
    value: stats.value?.totalUsers ?? 0,
    icon: 'i-heroicons-user-group',
  },
  {
    id: 'pending-certificates',
    label: 'Pending Certificates',
    value: stats.value?.pendingCertificates ?? 0,
    icon: 'i-heroicons-document-text',
  },
  {
    id: 'active-volunteers',
    label: 'Active Volunteers',
    value: stats.value?.activeVolunteers ?? 0,
    icon: 'i-heroicons-hand-raised',
  },
  {
    id: 'pending-timelog',
    label: 'Pending Time Log',
    value: stats.value?.pendingTimeLogs ?? 0,
    icon: 'i-heroicons-clock',
  },
])
</script>

<template>
  <div class="flex flex-col w-screen min-h-screen bg-slate-50 items-stretch pb-20 dark:bg-gray-900">
    <!-- Header for KPI -->
    <div class="px-4 sm:px-6 mt-20">
      <h1 class="text-2xl sm:text-3xl font-bold text-[#313131] dark:text-teal-400">
        Welcome back, Admin!
      </h1>
    </div>
    <!-- KPI section -->
    <section class="px-4 sm:px-6 mt-7 grid grid-cols-2 gap-3 sm:gap-6">
      <div
        v-for="kpi in kpis"
        :key="kpi.id"
        class="bg-white dark:bg-gray-800 rounded-2xl border-2 border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
      >
        <div class="flex items-start justify-between mb-3 sm:mb-4">
          <div
            class="flex rounded-xl h-10 w-10 sm:h-12 sm:w-12 p-2 shadow-md bg-slate-100 dark:bg-gray-700"
          >
            <UIcon
              :name="kpi.icon"
              class="w-6 h-6 sm:w-8 sm:h-8 text-black dark:text-white"
            />
          </div>
        </div>

        <div class="space-y-1">
          <p class="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-300">
            {{ kpi.label }}
          </p>
          <h3 class="text-2xl sm:text-3xl font-bold text-[#313131] dark:text-white">
            {{ kpi.value }}
          </h3>
          <div class="flex items-center gap-2 text-sm" />
        </div>
      </div>
    </section>
    <USeparator class="mt-8 sm:mt-10" />
    <!-- Features section -->
    <section class="px-4 sm:px-6 mt-8 sm:mt-10 grid grid-cols-2 gap-3 sm:gap-6">
      <UButton
        v-for="feature in features"
        :key="feature.id"
        :to="feature.to"
        color="brand6"
        class="group flex h-40 flex-col p-3 sm:p-4 items-start justify-between rounded-3xl border-2 border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 text-left shadow-xs transition-all duration-300 hover:shadow-xl hover:border-slate-300 dark:hover:border-gray-600 hover:bg-slate-100 dark:hover:bg-gray-700"
      >
        <div
          :class="feature.iconBg"
          class="flex rounded-xl h-9 w-9 sm:h-10 sm:w-10 p-1.5 shadow-lg transition-transform duration-300 group-hover:scale-105"
        >
          <UIcon
            :name="feature.icon"
            class="w-6 h-6 sm:w-7 sm:h-7 text-white"
          />
        </div>
        <span class="text-base sm:text-lg font-bold tracking-wide text-[#313131] dark:text-white text-balance whitespace-normal">
          {{ feature.label }}
        </span>

        <span
          v-if="feature.description"
          class=" text-[11px] leading-tight text-slate-700 dark:text-gray-300 whitespace-normal"
        >
          {{ feature.description }}
        </span>
        <div class="flex text-[#3a696e] dark:text-teal-400 font-medium text-sm">
          <span class="transition-transform duration-300 group-hover:translate-x-1">
            Manage →
          </span>
        </div>
      </UButton>
    </section>
  </div>
</template>
