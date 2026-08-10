<script setup lang="ts">
import type { TrainingAttendee } from '~/components/event/TrainingApprovalList.vue'

/**
 * Training approval queue: past training events and the volunteers who
 * attended, split into "needs review" and "completed".
 *
 * This is where PENDING volunteers become APPROVED — attending a training is
 * the prerequisite, and staff confirm attendance here. Approving from this page
 * is what unlocks volunteer-only events for that person.
 *
 * An event leaves the queue once no attendee is still PENDING, so denying
 * everyone also counts as complete.
 */

interface TrainingEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  address: string
  attendees: TrainingAttendee[]
  pendingCount: number
  approvedCount: number
  rejectedCount: number
}

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: trainings, refresh, pending, error } = await useFetch<TrainingEvent[]>(
  '/api/admin/training-events',
  { headers, default: () => [] },
)

// An event stays in the queue until every volunteer who attended has been
// approved or denied; then it drops into the completed list below.
const needsReview = computed(() => trainings.value.filter(t => t.pendingCount > 0))
const completed = computed(() => trainings.value.filter(t => t.pendingCount === 0))

const pendingVolunteers = computed(() =>
  needsReview.value.reduce((total, t) => total + t.pendingCount, 0),
)

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function summarize(training: TrainingEvent) {
  if (training.attendees.length === 0) return 'No volunteers signed up'
  const parts = [`${training.approvedCount} approved`]
  if (training.rejectedCount > 0) parts.push(`${training.rejectedCount} denied`)
  if (training.pendingCount > 0) parts.push(`${training.pendingCount} awaiting review`)
  return parts.join(' · ')
}

function toAccordionItems(list: TrainingEvent[]) {
  return list.map(training => ({
    value: training.id,
    label: training.title,
    training,
  }))
}
</script>

<template>
  <div class="flex flex-col w-screen min-h-screen bg-slate-50 dark:bg-gray-900 items-stretch pb-20">
    <div class="px-6 pt-20">
      <UButton
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
        class="-ml-2 mb-2"
        to="/admin"
      >
        Admin
      </UButton>

      <h1 class="text-3xl font-bold text-[#313131] dark:text-white">
        Training <span class="text-teal-600 dark:text-teal-400">Certificates</span>
      </h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Training events appear here once they've finished, so you approve the
        volunteers who actually attended.
      </p>

      <!-- Loading -->
      <div
        v-if="pending"
        class="flex justify-center items-center h-40"
      >
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-6 h-6 animate-spin text-teal-600"
        />
      </div>

      <div
        v-else-if="error"
        class="mt-8 text-red-500 text-sm"
      >
        Failed to load training events.
      </div>

      <template v-else>
        <!-- Queue -->
        <section class="mt-8">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-xl font-semibold text-[#313131] dark:text-white">
              Awaiting Review
            </h2>
            <span
              v-if="pendingVolunteers > 0"
              class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            >
              {{ pendingVolunteers }} volunteer{{ pendingVolunteers === 1 ? '' : 's' }}
            </span>
          </div>

          <div
            v-if="needsReview.length === 0"
            class="mt-4 rounded-xl bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            Nothing to review — every finished training has been actioned.
          </div>

          <UAccordion
            v-else
            type="multiple"
            class="bg-slate-50 dark:bg-gray-900 w-full"
            :items="toAccordionItems(needsReview)"
            :default-value="needsReview.map(t => t.id)"
            :ui="{
              item: 'border-none mt-4',
              header: 'px-0',
              trigger: 'block w-full text-left p-0',
              trailingIcon: 'hidden pointer-events-none',
            }"
          >
            <template #default="{ item, open }">
              <div class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-transparent dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 w-full">
                  <div class="min-w-0">
                    <h3 class="text-lg font-semibold truncate text-[#313131] dark:text-white">
                      {{ item.training.title }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {{ formatDate(item.training.endTime) }}
                      <span v-if="item.training.address"> · {{ item.training.address }}</span>
                    </p>
                  </div>

                  <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    {{ item.training.pendingCount }} pending
                  </span>

                  <span
                    class="text-gray-400 dark:text-gray-500 transition-transform duration-200"
                    :class="open ? 'rotate-180' : ''"
                  >
                    ▾
                  </span>
                </div>
              </div>
            </template>

            <template #content="{ item }">
              <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-black/20 px-5 pb-5 pt-2 mt-1 border border-transparent dark:border-gray-700">
                <EventTrainingApprovalList
                  :attendees="item.training.attendees"
                  @updated="refresh"
                />
                <UButton
                  variant="link"
                  color="neutral"
                  size="sm"
                  class="mt-2 px-0"
                  :to="`/events/${item.training.id}`"
                >
                  View event
                </UButton>
              </div>
            </template>
          </UAccordion>
        </section>

        <USeparator class="mt-10" />

        <!-- Completed -->
        <section class="mt-8">
          <h2 class="text-xl font-semibold text-[#313131] dark:text-white">
            Past Trainings
          </h2>

          <div
            v-if="completed.length === 0"
            class="mt-4 rounded-xl bg-white dark:bg-gray-800 border border-transparent dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            No completed trainings yet.
          </div>

          <UAccordion
            v-else
            type="multiple"
            class="bg-slate-50 dark:bg-gray-900 w-full"
            :items="toAccordionItems(completed)"
            :ui="{
              item: 'border-none mt-4',
              header: 'px-0',
              trigger: 'block w-full text-left p-0',
              trailingIcon: 'hidden pointer-events-none',
            }"
          >
            <template #default="{ item, open }">
              <div class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-transparent dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                <div class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 w-full">
                  <div class="min-w-0">
                    <h3 class="text-lg font-semibold truncate text-[#313131] dark:text-white">
                      {{ item.training.title }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {{ formatDate(item.training.endTime) }} · {{ summarize(item.training) }}
                    </p>
                  </div>

                  <UIcon
                    name="i-lucide-check-circle-2"
                    class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
                  />

                  <span
                    class="text-gray-400 dark:text-gray-500 transition-transform duration-200"
                    :class="open ? 'rotate-180' : ''"
                  >
                    ▾
                  </span>
                </div>
              </div>
            </template>

            <template #content="{ item }">
              <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-black/20 px-5 pb-5 pt-2 mt-1 border border-transparent dark:border-gray-700">
                <!-- Denied volunteers can still be approved later, so the
                     actions stay available on completed trainings. -->
                <EventTrainingApprovalList
                  :attendees="item.training.attendees"
                  empty-message="No volunteers signed up for this training."
                  @updated="refresh"
                />
                <UButton
                  variant="link"
                  color="neutral"
                  size="sm"
                  class="mt-2 px-0"
                  :to="`/events/${item.training.id}`"
                >
                  View event
                </UButton>
              </div>
            </template>
          </UAccordion>
        </section>
      </template>
    </div>
  </div>
</template>
