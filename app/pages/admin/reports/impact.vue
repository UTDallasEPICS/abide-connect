<script setup lang="ts">
import type { ImpactReport } from '#shared/types/reports'
import { formatCompact, formatCurrency } from '~/lib/chart'

definePageMeta({
  layout: 'secondary',
  backText: 'Reports',
  backTo: '/admin/reports',
})

/**
 * The leadership and funder view of volunteer contribution.
 *
 * Admin-only for now, as asked: there is no board or funder role in the schema
 * yet, so this page and `/api/admin/reports/impact` both check `admin`. Adding
 * that role later should mean changing those two checks and nothing else, which
 * is why nothing here reads a role directly.
 *
 * Two rules separate this page from `/admin/reports`, and both exist because
 * numbers from here end up in documents the org can be held to:
 *   - approved hours only, whatever the operational page is set to;
 *   - the hourly rate is shown with its source, next to the figure it produced.
 *
 * Guarded by the `/admin` prefix in `auth.global.ts`, not by the opt-in `auth`
 * middleware — see the note on `/admin/reports` for why that one breaks SSR.
 */

const { filter, query, queryString } = useReportFilter('YTD')

const { data: report, status, error, refresh } = await useFetch<ImpactReport>(
  '/api/admin/reports/impact',
  {
    query,
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
  },
)

const pending = computed(() => status.value === 'pending')
const totals = computed(() => report.value?.totals)

const volunteerDelta = computed(() => {
  const current = totals.value
  if (!current || current.priorVolunteers <= 0) return null
  return ((current.volunteers - current.priorVolunteers) / current.priorVolunteers) * 100
})

/** Widest bar in the program breakdown, for the inline proportion bars. */
const maxProgramHours = computed(() =>
  Math.max(1, ...(report.value?.programs ?? []).map(program => program.hours)),
)

const inferredHours = computed(() =>
  (report.value?.programs ?? []).reduce((total, program) => total + program.inferredHours, 0),
)

function exportHref(dataset: 'logs' | 'volunteers' | 'programs') {
  // Approved-only, matching what this page counts — an export from the funder
  // report must not contain hours the report itself excluded.
  return `/api/admin/reports/export?dataset=${dataset}&${queryString.value}&status=approved`
}
</script>

<template>
  <div class="flex flex-1 flex-col bg-slate-50 dark:bg-gray-900">
    <PageContainer width="wide">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-[#313131] dark:text-white">
            Volunteer <span class="text-teal-600 dark:text-teal-400">Impact</span>
          </h1>
          <p class="text-sm font-medium text-slate-600 dark:text-gray-400 mt-1">
            Contribution and in-kind value for leadership and grant reporting.
          </p>
        </div>

        <UButton
          to="/admin/reports"
          color="neutral"
          variant="subtle"
          size="sm"
          icon="i-lucide-chart-line"
        >
          Operational report
        </UButton>
      </div>

      <div class="mt-5">
        <ReportsRangeFilter
          v-model="filter"
          :resolved-label="report?.range.label"
          :loading="pending"
          hide-status
        />
      </div>

      <div
        v-if="error"
        class="mt-6 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950 px-4 py-3"
      >
        <p class="text-sm font-semibold text-rose-700 dark:text-rose-300">
          {{ error.statusMessage || 'This report could not be loaded.' }}
        </p>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          class="mt-2"
          @click="refresh()"
        >
          Try again
        </UButton>
      </div>

      <div
        v-else-if="report"
        class="transition-opacity duration-200"
        :class="pending ? 'opacity-60' : 'opacity-100'"
      >
        <p
          v-if="report.rate.usingDefaults"
          class="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-4 py-3"
        >
          <UIcon
            name="i-lucide-alert-triangle"
            class="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <span class="text-xs font-medium text-amber-900 dark:text-amber-200">
            The volunteer hourly rate has never been reviewed — every dollar figure below uses the
            built-in default. Confirm this year's published rate in
            <NuxtLink
              to="/admin/reports"
              class="underline font-semibold"
            >report settings</NuxtLink>
            before sending this to a funder.
          </span>
        </p>

        <section class="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <ReportsStatTile
            label="Volunteer hours"
            :value="formatCompact(totals!.hours)"
            :detail="`${totals!.priorHours.toLocaleString()} hrs in ${report.priorRange.label}`"
            icon="i-lucide-clock"
            :delta-pct="totals!.hoursChangePct"
            delta-label="year over year"
            :up-is-good="true"
            hero
          />
          <ReportsStatTile
            label="Estimated in-kind value"
            :value="formatCurrency(totals!.inKindValue, true)"
            :detail="`at ${formatCurrency(report.rate.hourlyRate)} per hour`"
            icon="i-lucide-hand-coins"
          />
          <ReportsStatTile
            label="Volunteers contributing"
            :value="totals!.volunteers.toLocaleString()"
            :detail="`${totals!.averageHoursPerVolunteer} hrs each on average`"
            icon="i-lucide-users"
            :delta-pct="volunteerDelta"
            delta-label="year over year"
            :up-is-good="true"
          />
          <ReportsStatTile
            label="Full-time equivalent"
            :value="`${totals!.fullTimeEquivalent} FTE`"
            detail="At 2,080 hours per staff year"
            icon="i-lucide-briefcase"
          />
        </section>

        <div class="mt-4 sm:mt-5 grid gap-4 sm:gap-5">
          <ReportsChartCard
            title="Hours by month, against last year"
            subtitle="This period in colour, with last year's total marked across each column."
            note="Approved hours only. Months are matched by position, so a period starting mid-month lines up with the same offset a year earlier."
          >
            <ReportsYearOverYearChart :points="report.monthly" />

            <template #table>
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold text-slate-500 dark:text-gray-400">
                    <th class="py-2 pr-4">
                      Month
                    </th>
                    <th class="py-2 pr-4 text-right">
                      Hours
                    </th>
                    <th class="py-2 text-right">
                      A year earlier
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-gray-700">
                  <tr
                    v-for="point in report.monthly"
                    :key="point.key"
                  >
                    <td class="py-1.5 pr-4 font-medium text-slate-700 dark:text-gray-300">
                      {{ point.label }}
                    </td>
                    <td class="py-1.5 pr-4 text-right tabular-nums text-slate-900 dark:text-white">
                      {{ point.hours.toLocaleString() }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums text-slate-700 dark:text-gray-300">
                      {{ point.priorHours.toLocaleString() }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </ReportsChartCard>

          <ReportsChartCard
            title="Hours by program"
            subtitle="What the hours were spent on, and what each program's contribution is worth."
            :note="inferredHours > 0
              ? `${Math.round(inferredHours)} hours are attributed from the volunteer's single declared area rather than tagged on the log itself. Set a program when approving hours to make this exact.`
              : 'Programs come from the tag on each hour log. Hours from volunteers with several declared areas and no tag are reported as Unassigned rather than split.'"
            table-only
          >
            <div
              v-if="report.programs.length === 0"
              class="py-8 text-center text-sm font-medium text-slate-500 dark:text-gray-400"
            >
              No approved hours in this period.
            </div>

            <table
              v-else
              class="w-full text-sm"
            >
              <thead>
                <tr class="text-left text-xs font-semibold text-slate-500 dark:text-gray-400">
                  <th class="py-2 pr-4">
                    Program
                  </th>
                  <th class="py-2 pr-4 text-right">
                    Volunteers
                  </th>
                  <th class="py-2 pr-4 text-right">
                    Hours
                  </th>
                  <th class="py-2 text-right">
                    In-kind value
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-gray-700">
                <tr
                  v-for="program in report.programs"
                  :key="program.program"
                >
                  <td class="py-2 pr-4">
                    <p class="font-semibold text-slate-800 dark:text-gray-200">
                      {{ program.label }}
                    </p>
                    <!-- Proportion bar in the accent hue: one series, so one
                         colour for every row rather than a value ramp. -->
                    <span
                      class="mt-1 block h-1.5 rounded-full"
                      :style="{
                        width: `${Math.max(2, (program.hours / maxProgramHours) * 100)}%`,
                        background: 'var(--viz-series-1)',
                      }"
                    />
                  </td>
                  <td class="py-2 pr-4 text-right tabular-nums text-slate-700 dark:text-gray-300 align-top">
                    {{ program.volunteers }}
                  </td>
                  <td class="py-2 pr-4 text-right tabular-nums font-semibold text-slate-900 dark:text-white align-top">
                    {{ program.hours.toLocaleString() }}
                  </td>
                  <td class="py-2 text-right tabular-nums text-slate-700 dark:text-gray-300 align-top">
                    {{ formatCurrency(program.value, true) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </ReportsChartCard>

          <section
            class="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm"
          >
            <h2 class="text-base sm:text-lg font-bold text-[#313131] dark:text-white">
              Export this report
            </h2>
            <p class="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400 mt-0.5">
              Every export covers exactly the dates above, so a grant period that doesn't match a
              fiscal preset still comes out as one file. Each carries the rate and its source in the
              header.
            </p>

            <div class="flex flex-wrap gap-2 mt-4">
              <UButton
                :to="exportHref('logs')"
                external
                download
                color="brand4"
                size="sm"
                icon="i-lucide-download"
              >
                Every entry
              </UButton>
              <UButton
                :to="exportHref('volunteers')"
                external
                download
                color="neutral"
                variant="subtle"
                size="sm"
                icon="i-lucide-download"
              >
                Totals by volunteer
              </UButton>
              <UButton
                :to="exportHref('programs')"
                external
                download
                color="neutral"
                variant="subtle"
                size="sm"
                icon="i-lucide-download"
              >
                Totals by program
              </UButton>
            </div>

            <p class="mt-4 text-[11px] font-medium text-slate-500 dark:text-gray-400">
              In-kind value uses {{ formatCurrency(report.rate.hourlyRate) }} per volunteer hour —
              {{ report.rate.source }}<span v-if="report.rate.updatedAt">, last reviewed
                {{ new Date(report.rate.updatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) }}</span>.
            </p>
          </section>
        </div>
      </div>
    </PageContainer>
  </div>
</template>
