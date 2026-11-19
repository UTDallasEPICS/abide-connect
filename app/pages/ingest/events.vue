<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { eventTypeLabel, type EventType } from '#shared/utils/eventType'
import { formatEventWhen } from '#shared/utils/eventTime'

definePageMeta({
  layout: 'secondary',
  backText: 'Admin',
  backTo: '/admin',
})

/**
 * Bulk import of a Monday.com events-board CSV export.
 *
 * The sibling of the volunteer importer at `/ingest`, and unlinked for the same
 * reason: the access check that matters is `requireRole(event, 'admin')` inside
 * `/api/admin/ingest/events`, with the `/ingest` prefix in `auth.global.ts`
 * keeping the page itself from rendering for anyone else.
 *
 * Preview-then-commit against one endpoint, so what the table shows is what
 * will be written. The two defaults above the buttons cover what a board row
 * may leave out — who the event is for and where it is — and changing either
 * discards the preview, since it would no longer describe the import.
 */

type EventAction = 'CREATE' | 'ALREADY_IMPORTED' | 'NEEDS_LOCATION'

interface EventReport {
  rowNumber: number
  title: string
  startTime: string
  endTime: string
  location: string | null
  usedDefaultLocation: boolean
  eventType: EventType
  eventTypeRaw: string | null
  usedDefaultType: boolean
  action: EventAction
  warnings: string[]
  error?: string
}

interface IngestResult {
  mode: 'preview' | 'commit'
  totalRows: number
  missingColumns: string[]
  rejected: { rowNumber: number, title: string, errors: string[] }[]
  summary: {
    events: number
    create: number
    alreadyImported: number
    needsLocation: number
    withWarnings: number
    newLocations: number
    failed: number
  }
  events: EventReport[]
}

const fileName = ref('')
const csvText = ref('')
const defaultEventType = ref<EventType>('VOLUNTEERS_AND_ATTENDEES')
const defaultLocation = ref('')
const pending = ref(false)
const errorMessage = ref('')
const result = ref<IngestResult | null>(null)

type Filter = 'all' | 'warnings' | 'new' | 'skipped'

const filter = ref<Filter>('all')

const FILTERS: { id: Filter, label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'new', label: 'New' },
  { id: 'skipped', label: 'Skipped' },
]

const ACTION_LABELS: Record<EventAction, string> = {
  CREATE: 'New event',
  ALREADY_IMPORTED: 'Already imported',
  NEEDS_LOCATION: 'No location',
}

const ACTION_COLORS: Record<EventAction, string> = {
  CREATE: 'success',
  ALREADY_IMPORTED: 'neutral',
  NEEDS_LOCATION: 'error',
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileName.value = file.name
  csvText.value = await file.text()
  // A preview of the previous file would be read as this one's.
  result.value = null
  errorMessage.value = ''
}

// The preview was computed with the old defaults; showing it beside new ones
// would have the admin approving an import that isn't the one that runs.
watch([defaultEventType, defaultLocation], () => {
  if (result.value?.mode === 'preview') result.value = null
})

async function run(commit: boolean) {
  if (!csvText.value) return
  pending.value = true
  errorMessage.value = ''

  try {
    result.value = await $fetch<IngestResult>('/api/admin/ingest/events', {
      method: 'POST',
      body: {
        csv: csvText.value,
        commit,
        defaultEventType: defaultEventType.value,
        defaultLocation: defaultLocation.value,
      },
    })
  }
  catch (error) {
    const e = error as { statusMessage?: string, data?: { statusMessage?: string }, message?: string }
    errorMessage.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'The import failed.'
  }
  finally {
    pending.value = false
  }
}

const committed = computed(() => result.value?.mode === 'commit')

const visibleEvents = computed(() => {
  const events = result.value?.events ?? []
  if (filter.value === 'warnings') return events.filter(e => e.warnings.length > 0 || e.error)
  if (filter.value === 'new') return events.filter(e => e.action === 'CREATE')
  if (filter.value === 'skipped') return events.filter(e => e.action !== 'CREATE')
  return events
})

const createdCount = computed(() => {
  const summary = result.value?.summary
  return summary ? summary.create - summary.failed : 0
})
</script>

<template>
  <PageContainer width="wide">
    <div class="flex flex-col gap-6">
      <header>
        <h1 class="text-2xl font-semibold">
          Event import
        </h1>
        <p class="mt-1 text-sm text-muted">
          Upload a CSV export of the Monday.com events board. Nothing is written until you review
          the preview and choose to import.
        </p>
      </header>

      <UCard>
        <div class="flex flex-col gap-4">
          <UFormField
            label="CSV file"
            :description="fileName ? `Loaded ${fileName}` : 'A .csv export of the events board.'"
          >
            <input
              type="file"
              accept=".csv,text/csv"
              class="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-inverted"
              @change="onFile"
            >
          </UFormField>

          <EventTypeSelector
            v-model="defaultEventType"
            label="Who are these events for, when a row doesn't say?"
          />

          <UFormField
            label="Default location"
            description="Used for rows with no address. Leave blank to skip those rows instead."
          >
            <UInput
              v-model="defaultLocation"
              placeholder="Street address"
              class="w-full"
            />
          </UFormField>

          <div class="flex flex-wrap items-center gap-3">
            <UButton
              :loading="pending"
              :disabled="!csvText"
              icon="i-lucide-eye"
              @click="run(false)"
            >
              Preview
            </UButton>
            <UButton
              v-if="result && !committed && result.summary.create > 0"
              color="primary"
              variant="solid"
              :loading="pending"
              icon="i-lucide-database"
              @click="run(true)"
            >
              Import {{ result.summary.create }} event{{ result.summary.create === 1 ? '' : 's' }}
            </UButton>
          </div>

          <p
            v-if="result && !committed && result.summary.newLocations > 0"
            class="text-xs text-muted"
          >
            {{ result.summary.newLocations }} new address{{ result.summary.newLocations === 1 ? '' : 'es' }}
            will be looked up on the map, about a second each.
          </p>

          <UAlert
            v-if="errorMessage"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="errorMessage"
          />
        </div>
      </UCard>

      <template v-if="result">
        <UAlert
          v-if="committed"
          :color="result.summary.failed > 0 ? 'warning' : 'success'"
          variant="subtle"
          :icon="result.summary.failed > 0 ? 'i-lucide-triangle-alert' : 'i-lucide-check'"
          :title="result.summary.failed > 0 ? 'Imported with failures' : 'Imported'"
          :description="`${createdCount} event(s) created. ${result.summary.failed} failed.`"
        />

        <UAlert
          v-if="result.missingColumns.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-columns-3"
          title="Columns not found in this file"
          :description="`${result.missingColumns.join(', ')} — the defaults above apply to every row.`"
        />

        <UCard v-if="result.rejected.length">
          <template #header>
            <h2 class="font-medium text-error">
              {{ result.rejected.length }} row(s) cannot be imported
            </h2>
          </template>
          <ul class="flex flex-col gap-1 text-sm">
            <li
              v-for="row in result.rejected"
              :key="row.rowNumber"
            >
              <span class="font-mono text-xs text-muted">row {{ row.rowNumber }}</span>
              {{ row.title || '(no name)' }} — {{ row.errors.join(' ') }}
            </li>
          </ul>
        </UCard>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <UCard
            v-for="stat in [
              { label: 'Rows in file', value: result.totalRows },
              { label: committed ? 'Events created' : 'Events to create', value: committed ? createdCount : result.summary.create },
              { label: 'Already imported', value: result.summary.alreadyImported },
              { label: 'With warnings', value: result.summary.withWarnings },
            ]"
            :key="stat.label"
            :ui="{ body: 'p-4' }"
          >
            <p class="text-2xl font-semibold">
              {{ stat.value }}
            </p>
            <p class="text-xs text-muted">
              {{ stat.label }}
            </p>
          </UCard>
        </div>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="font-medium">
                {{ committed ? 'Result' : 'Preview' }}
              </h2>
              <div class="flex flex-wrap gap-1">
                <UButton
                  v-for="option in FILTERS"
                  :key="option.id"
                  size="xs"
                  :variant="filter === option.id ? 'solid' : 'outline'"
                  @click="filter = option.id"
                >
                  {{ option.label }}
                </UButton>
              </div>
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full min-w-3xl text-left text-sm">
              <thead class="border-b border-default text-xs uppercase text-muted">
                <tr>
                  <th class="px-4 py-2 font-medium">
                    Event
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Action
                  </th>
                  <th class="px-4 py-2 font-medium">
                    When
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Where
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Audience
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in visibleEvents"
                  :key="item.rowNumber"
                  class="border-b border-default/60 align-top"
                >
                  <td class="px-4 py-3">
                    <p class="font-medium">
                      {{ item.title }}
                    </p>
                    <p class="font-mono text-xs text-muted">
                      row {{ item.rowNumber }}
                    </p>
                    <p
                      v-for="warning in item.warnings"
                      :key="warning"
                      class="text-xs text-warning"
                    >
                      {{ warning }}
                    </p>
                    <p
                      v-if="item.error"
                      class="text-xs text-error"
                    >
                      Failed: {{ item.error }}
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="ACTION_COLORS[item.action] as never"
                      variant="subtle"
                      size="sm"
                    >
                      {{ ACTION_LABELS[item.action] }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3 text-xs">
                    {{ formatEventWhen(item.startTime, item.endTime) }}
                  </td>
                  <td class="px-4 py-3 text-xs">
                    {{ item.location ?? '—' }}
                    <span
                      v-if="item.usedDefaultLocation"
                      class="text-muted"
                    >(default)</span>
                  </td>
                  <td class="px-4 py-3 text-xs">
                    {{ eventTypeLabel(item.eventType) }}
                    <span
                      v-if="item.usedDefaultType"
                      class="text-muted"
                    >(default)</span>
                  </td>
                </tr>
                <tr v-if="!visibleEvents.length">
                  <td
                    colspan="5"
                    class="px-4 py-8 text-center text-sm text-muted"
                  >
                    Nothing matches this filter.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </template>
    </div>
  </PageContainer>
</template>
