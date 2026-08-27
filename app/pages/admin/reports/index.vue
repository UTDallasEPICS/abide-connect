<script setup lang="ts">
import type { HoursReport } from '#shared/types/reports'
import { formatCompact, formatIsoDate } from '~/lib/chart'

definePageMeta({
  layout: 'secondary',
  backText: 'Admin',
  backTo: '/admin',
})

/**
 * Volunteer hours reporting for staff.
 *
 * Reachable only with the `admin` role — the `/admin` prefix in
 * `auth.global.ts` guards the route, and every endpoint the page calls runs its
 * own `requireRole`, so the guard is a redirect rather than the access control.
 *
 * All seven panels come from one `/api/admin/reports/hours` call against one
 * filter. Per-panel filters were the alternative and they're a trap: two cards
 * scoped to different periods sitting side by side get read as one comparison.
 *
 * No `middleware: 'auth'` here on purpose. That opt-in guard calls
 * `/api/auth/get-session` with a bare `$fetch` that forwards no cookies, so on
 * a server-rendered request it always sees no session and redirects to login —
 * the page would never render for anyone who followed a link into it.
 * `auth.global.ts` covers `/admin` already and does forward the cookie.
 */

const { filter, query, queryString } = useReportFilter('YTD')

const { data: report, status, error, refresh } = await useFetch<HoursReport>(
  '/api/admin/reports/hours',
  {
    query,
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
  },
)

const pending = computed(() => status.value === 'pending')

const showHeadcount = ref(true)
function toggleHeadcount() {
  showHeadcount.value = !showHeadcount.value
}

const summary = computed(() => report.value?.summary)

/** Percentage change against the same period a year earlier. */
const hoursDelta = computed(() => {
  const current = summary.value
  if (!current || current.priorPeriodHours <= 0) return null
  return ((current.totalHours - current.priorPeriodHours) / current.priorPeriodHours) * 100
})

const backlogDetail = computed(() => {
  const backlog = report.value?.backlog
  if (!backlog) return ''
  if (backlog.pendingCount === 0) return 'Queue is clear'

  const oldest = backlog.oldestPendingDays
  return `${backlog.pendingHours} hrs waiting · oldest ${oldest ?? 0} days old`
})

const approvalDetail = computed(() => {
  const backlog = report.value?.backlog
  if (!backlog) return ''
  if (backlog.medianDaysToDecision === null) {
    return backlog.decidedCount > 0
      ? `${backlog.decidedCount} decided, none with a recorded decision time yet`
      : 'No decisions in this period'
  }
  return `Across ${backlog.decidedCount - backlog.unmeasuredCount} decisions in this period`
})

const statusNote = computed(() =>
  report.value?.range.status === 'all'
    ? 'Counting approved and pending hours.'
    : 'Counting approved hours only.',
)

const exportHref = computed(() => `/api/admin/reports/export?dataset=logs&${queryString.value}`)
</script>

<template>
  <div class="flex flex-col w-full min-h-[calc(100vh-4.75rem)] bg-slate-50 dark:bg-gray-900 pb-24">
    <div class="px-4 sm:px-6 pt-4 max-w-6xl w-full mx-auto">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-[#313131] dark:text-white">
            Volunteer Hours <span class="text-teal-600 dark:text-teal-400">Reporting</span>
          </h1>
          <p class="text-sm font-medium text-slate-600 dark:text-gray-400 mt-1">
            Where the hours are going, and who is drifting away.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            to="/admin/reports/impact"
            color="neutral"
            variant="subtle"
            size="sm"
            icon="i-lucide-presentation"
          >
            Impact report
          </UButton>
        </div>
      </div>

      <!-- One filter row, above everything it scopes. -->
      <div class="mt-5">
        <ReportsRangeFilter
          v-model="filter"
          :resolved-label="report?.range.label"
          :loading="pending"
        >
          <template #actions>
            <UButton
              :to="exportHref"
              external
              download
              color="neutral"
              variant="subtle"
              size="sm"
              icon="i-lucide-download"
            >
              Export CSV
            </UButton>
          </template>
        </ReportsRangeFilter>
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

      <!-- Previous render held at reduced opacity while refetching, rather
           than a skeleton that would jump the layout on every filter change. -->
      <div
        v-else-if="report"
        class="transition-opacity duration-200"
        :class="pending ? 'opacity-60' : 'opacity-100'"
      >
        <section class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <ReportsStatTile
            label="Total hours"
            :value="formatCompact(summary!.totalHours)"
            :detail="`${summary!.totalEntries.toLocaleString()} entries logged`"
            icon="i-lucide-clock"
            :delta-pct="hoursDelta"
            delta-label="vs a year earlier"
            :up-is-good="true"
            hero
          />
          <ReportsStatTile
            label="Volunteers active"
            :value="summary!.activeVolunteers.toLocaleString()"
            :detail="`of ${summary!.rosterVolunteers} approved on the roster`"
            icon="i-lucide-users"
          />
          <ReportsStatTile
            label="Median per volunteer"
            :value="`${summary!.medianHoursPerVolunteer} hrs`"
            :detail="`Mean ${summary!.meanHoursPerVolunteer} hrs — the gap is the long tail`"
            icon="i-lucide-scale"
          />
          <ReportsStatTile
            label="Awaiting approval"
            :value="report.backlog.pendingCount.toLocaleString()"
            :detail="backlogDetail"
            icon="i-lucide-inbox"
          />
        </section>

        <div class="mt-4 sm:mt-5 grid gap-4 sm:gap-5">
          <ReportsChartCard
            title="Hours over time"
            subtitle="Volunteer headcount runs underneath on the same timeline. Hours flat while the headcount climbs means engagement is thinning, not growing."
            :note="statusNote"
          >
            <template #actions>
              <UButton
                size="xs"
                color="neutral"
                :variant="showHeadcount ? 'subtle' : 'ghost'"
                :aria-pressed="showHeadcount"
                @click="toggleHeadcount"
              >
                Headcount
              </UButton>
            </template>

            <ReportsTimeSeriesChart
              :points="report.series"
              :show-headcount="showHeadcount"
            />

            <template #table>
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold text-slate-500 dark:text-gray-400">
                    <th class="py-2 pr-4">
                      Period
                    </th>
                    <th class="py-2 pr-4 text-right">
                      Hours
                    </th>
                    <th class="py-2 pr-4 text-right">
                      Volunteers
                    </th>
                    <th class="py-2 text-right">
                      Hrs / volunteer
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-gray-700">
                  <tr
                    v-for="point in report.series"
                    :key="point.key"
                  >
                    <td class="py-1.5 pr-4 font-medium text-slate-700 dark:text-gray-300">
                      {{ point.label }}
                    </td>
                    <td class="py-1.5 pr-4 text-right tabular-nums text-slate-900 dark:text-white">
                      {{ point.hours.toLocaleString() }}
                    </td>
                    <td class="py-1.5 pr-4 text-right tabular-nums text-slate-700 dark:text-gray-300">
                      {{ point.volunteers }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums text-slate-700 dark:text-gray-300">
                      {{ point.hoursPerVolunteer }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </ReportsChartCard>

          <div class="grid lg:grid-cols-2 gap-4 sm:gap-5">
            <ReportsChartCard
              title="Hours per volunteer"
              subtitle="How the work is spread across the people doing it."
              :note="report.distribution.totalVolunteers > 0
                ? `${report.distribution.volunteersForHalfOfHours} of ${report.distribution.totalVolunteers} volunteers accounted for half the hours; the busiest 10% did ${summary!.topDecileShare}% of them. Volunteers with no hours in this period are not counted.`
                : 'No hours were logged in this period.'"
            >
              <ReportsHistogramChart :distribution="report.distribution" />

              <template #table>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs font-semibold text-slate-500 dark:text-gray-400">
                      <th class="py-2 pr-4">
                        Hours logged
                      </th>
                      <th class="py-2 text-right">
                        Volunteers
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-gray-700">
                    <tr
                      v-for="bin in report.distribution.bins"
                      :key="bin.label"
                    >
                      <td class="py-1.5 pr-4 font-medium text-slate-700 dark:text-gray-300">
                        {{ bin.label }}
                      </td>
                      <td class="py-1.5 text-right tabular-nums text-slate-900 dark:text-white">
                        {{ bin.volunteers }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ReportsChartCard>

            <ReportsChartCard
              title="New vs. returning"
              subtitle="Whether the month's hours came from recruitment or from people coming back."
              note="A volunteer counts as first-time in the month they first ever logged hours, measured across their whole history."
            >
              <ReportsStackedBarChart :points="report.newVsReturning" />

              <template #table>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs font-semibold text-slate-500 dark:text-gray-400">
                      <th class="py-2 pr-4">
                        Month
                      </th>
                      <th class="py-2 pr-4 text-right">
                        First-time hrs
                      </th>
                      <th class="py-2 text-right">
                        Returning hrs
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-gray-700">
                    <tr
                      v-for="point in report.newVsReturning"
                      :key="point.key"
                    >
                      <td class="py-1.5 pr-4 font-medium text-slate-700 dark:text-gray-300">
                        {{ point.label }}
                      </td>
                      <td class="py-1.5 pr-4 text-right tabular-nums text-slate-900 dark:text-white">
                        {{ point.newHours.toLocaleString() }}
                      </td>
                      <td class="py-1.5 text-right tabular-nums text-slate-900 dark:text-white">
                        {{ point.returningHours.toLocaleString() }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </ReportsChartCard>
          </div>

          <ReportsChartCard
            title="Coverage by day and time"
            subtitle="Hours actually covered, by when they happened. The pale cells are the shifts nobody is taking."
            :note="report.coverage.needsAreUnknown
              ? 'No event in this period used time blocks, so shift capacity is unknown — the grid shows hours covered, with nothing to compare them against. Draw blocks on an event to get a fill rate.'
              : 'A shift is filed under the day and band it starts in. Fill rate compares hours covered against the capacity published on time blocks.'"
          >
            <ReportsCoverageHeatmap :coverage="report.coverage" />

            <template #table>
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs font-semibold text-slate-500 dark:text-gray-400">
                    <th class="py-2 pr-4">
                      Day
                    </th>
                    <th class="py-2 pr-4">
                      Band
                    </th>
                    <th class="py-2 pr-4 text-right">
                      Covered
                    </th>
                    <th class="py-2 pr-4 text-right">
                      Scheduled
                    </th>
                    <th class="py-2 text-right">
                      Filled
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-gray-700">
                  <tr
                    v-for="cell in report.coverage.cells.filter(c => c.filledHours > 0 || c.neededHours > 0)"
                    :key="`${cell.weekday}-${cell.band}`"
                  >
                    <td class="py-1.5 pr-4 font-medium text-slate-700 dark:text-gray-300">
                      {{ ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][cell.weekday] }}
                    </td>
                    <td class="py-1.5 pr-4 text-slate-700 dark:text-gray-300">
                      {{ report.coverage.bands.find(b => b.id === cell.band)?.label }}
                    </td>
                    <td class="py-1.5 pr-4 text-right tabular-nums text-slate-900 dark:text-white">
                      {{ cell.filledHours }}
                    </td>
                    <td class="py-1.5 pr-4 text-right tabular-nums text-slate-700 dark:text-gray-300">
                      {{ cell.neededHours || '—' }}
                    </td>
                    <td class="py-1.5 text-right tabular-nums text-slate-700 dark:text-gray-300">
                      {{ cell.fillRate === null ? '—' : `${Math.round(cell.fillRate * 100)}%` }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </ReportsChartCard>

          <ReportsChartCard
            title="Retention by signup cohort"
            subtitle="Of everyone who joined in a given month, how many were still logging hours later."
            note="Cohorts are drawn from volunteers who signed up inside the selected period; widen the range to follow older cohorts further. A dot means that month hasn't happened yet."
            table-only
          >
            <ReportsCohortGrid :retention="report.retention" />
          </ReportsChartCard>

          <div class="grid lg:grid-cols-2 gap-4 sm:gap-5">
            <ReportsChartCard
              :title="`Lapse risk — quiet ${report.lapseThresholdDays}+ days`"
              subtitle="Volunteers who used to log hours and have stopped, longest-quiet first."
              note="Ignores the date filter on purpose: someone whose last shift predates the selected period is exactly who this list is for. Never-active volunteers are excluded — they need onboarding, not outreach."
              table-only
            >
              <ReportsLapseRiskList
                :entries="report.lapseRisk"
                :threshold-days="report.lapseThresholdDays"
              />
            </ReportsChartCard>

            <ReportsChartCard
              title="Approval backlog"
              subtitle="How long volunteers are waiting to hear back about the hours they submitted."
              note="The queue counts are current, not period-scoped. The median only covers decisions with a recorded decision time — logs decided before that was tracked are counted separately rather than estimated."
              table-only
            >
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-xl bg-slate-50 dark:bg-gray-900 p-3">
                  <p class="text-xs font-medium text-slate-600 dark:text-gray-400">
                    Pending entries
                  </p>
                  <p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {{ report.backlog.pendingCount }}
                  </p>
                  <p class="text-[11px] font-medium text-slate-500 dark:text-gray-400 mt-1">
                    {{ report.backlog.pendingHours }} hours unverified
                  </p>
                </div>

                <div class="rounded-xl bg-slate-50 dark:bg-gray-900 p-3">
                  <p class="text-xs font-medium text-slate-600 dark:text-gray-400">
                    Oldest pending
                  </p>
                  <p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {{ report.backlog.oldestPendingDays === null ? '—' : `${report.backlog.oldestPendingDays}d` }}
                  </p>
                  <p class="text-[11px] font-medium text-slate-500 dark:text-gray-400 mt-1">
                    {{ report.backlog.oldestPendingDate
                      ? `Submitted ${formatIsoDate(report.backlog.oldestPendingDate)}`
                      : 'Nothing waiting' }}
                  </p>
                </div>

                <div class="rounded-xl bg-slate-50 dark:bg-gray-900 p-3 col-span-2">
                  <p class="text-xs font-medium text-slate-600 dark:text-gray-400">
                    Median time to a decision
                  </p>
                  <p class="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {{ report.backlog.medianDaysToDecision === null
                      ? '—'
                      : `${report.backlog.medianDaysToDecision} days` }}
                  </p>
                  <p class="text-[11px] font-medium text-slate-500 dark:text-gray-400 mt-1">
                    {{ approvalDetail }}
                  </p>
                </div>
              </div>

              <UButton
                to="/admin/volunteer-logs"
                color="brand4"
                size="sm"
                variant="subtle"
                icon="i-lucide-check-check"
                class="mt-4"
              >
                Go to the approval queue
              </UButton>
            </ReportsChartCard>
          </div>

          <ReportsSettingsCard @saved="refresh()" />
        </div>
      </div>
    </div>
  </div>
</template>
