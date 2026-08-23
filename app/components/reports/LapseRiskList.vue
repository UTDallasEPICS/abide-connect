<script setup lang="ts">
import type { LapseRiskEntry } from '#shared/types/reports'
import { formatIsoDate } from '~/lib/chart'

/**
 * Volunteers who used to log hours and have stopped, longest-quiet first.
 *
 * A list rather than a chart on purpose: the output of this panel is a phone
 * call, so it needs a name, a date and an email address next to each other, not
 * a shape. It's also the one panel on the page that ignores the date filter —
 * someone whose last shift predates the selected range is precisely who belongs
 * here, and scoping it to the range would empty it exactly when it matters.
 */

const props = defineProps<{
  entries: LapseRiskEntry[]
  thresholdDays: number
}>()

/**
 * Three bands rather than a continuous scale: the difference between 400 and
 * 420 days quiet is not a decision, but the difference between two months and a
 * year is. Each band ships an icon and a word, so severity never rests on
 * colour alone.
 */
function band(days: number) {
  if (days >= 365) {
    return { label: 'Dormant', icon: 'i-lucide-moon', tone: 'text-[var(--viz-critical)]' }
  }
  if (days >= 180) {
    return { label: 'At risk', icon: 'i-lucide-alert-triangle', tone: 'text-[var(--viz-critical)]' }
  }
  return { label: 'Slipping', icon: 'i-lucide-clock', tone: 'text-slate-600 dark:text-gray-400' }
}

const mailtoAll = computed(() => {
  const emails = props.entries
    .map(entry => entry.email)
    .filter((email): email is string => Boolean(email))
    .slice(0, 40)

  // BCC, not To: an outreach mail that exposes forty volunteers' addresses to
  // each other is a privacy incident, not a mail merge.
  return emails.length === 0
    ? null
    : `mailto:?bcc=${encodeURIComponent(emails.join(','))}`
      + `&subject=${encodeURIComponent('We\'d love to see you back at Abide')}`
})
</script>

<template>
  <div>
    <div
      v-if="entries.length === 0"
      class="py-8 text-center"
    >
      <UIcon
        name="i-lucide-check-circle-2"
        class="w-6 h-6 mx-auto text-[var(--viz-good)]"
      />
      <p class="mt-2 text-sm font-medium text-slate-600 dark:text-gray-400">
        Nobody has gone quiet for more than {{ thresholdDays }} days.
      </p>
    </div>

    <template v-else>
      <ul class="divide-y divide-slate-200 dark:divide-gray-700">
        <li
          v-for="entry in entries"
          :key="entry.volunteerId"
          class="py-3 flex items-center gap-3"
        >
          <UIcon
            :name="band(entry.daysSinceLastHour).icon"
            class="w-4 h-4 shrink-0"
            :class="band(entry.daysSinceLastHour).tone"
          />

          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {{ entry.name }}
            </p>
            <p class="text-xs font-medium text-slate-500 dark:text-gray-400 truncate">
              {{ band(entry.daysSinceLastHour).label }} · last seen at {{ entry.lastActivity }}
              on {{ formatIsoDate(entry.lastHourDate) }}
            </p>
          </div>

          <div class="text-right shrink-0">
            <p class="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {{ entry.daysSinceLastHour }}d
            </p>
            <p class="text-[11px] font-medium text-slate-500 dark:text-gray-400 tabular-nums">
              {{ entry.lifetimeHours }} hrs lifetime
            </p>
          </div>

          <UButton
            v-if="entry.email"
            :to="`mailto:${entry.email}`"
            external
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-mail"
            :aria-label="`Email ${entry.name}`"
          />
        </li>
      </ul>

      <UButton
        v-if="mailtoAll"
        :to="mailtoAll"
        external
        size="xs"
        color="neutral"
        variant="subtle"
        icon="i-lucide-send"
        class="mt-4"
      >
        Draft an email to this list
      </UButton>
    </template>
  </div>
</template>
