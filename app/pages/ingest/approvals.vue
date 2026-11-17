<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'secondary',
  backText: 'Admin',
  backTo: '/admin',
})

/**
 * Batch approval of volunteers from a CSV of people who passed training.
 *
 * The sibling of the volunteer importer at `/ingest`, and unlinked for the same
 * reason: the access check that matters is `requireRole(event, 'admin')` inside
 * `/api/admin/ingest/approvals`, with the `/ingest` prefix in `auth.global.ts`
 * keeping the page itself from rendering for anyone else.
 *
 * Preview-then-commit against one endpoint. The preview matters more here than
 * anywhere: approving is what opens volunteer-only events to someone, the file
 * is matched on email alone, and a typo'd address that happens to belong to a
 * different applicant would approve the wrong person. The table puts the name
 * on the list next to the name on the account so that is visible before the
 * button is.
 */

type ApprovalAction = 'APPROVE' | 'ALREADY_APPROVED' | 'NO_VOLUNTEER_PROFILE' | 'NOT_FOUND'

interface ApprovalReport {
  rowNumber: number
  email: string
  listedName: string | null
  accountName: string | null
  action: ApprovalAction
  currentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  warnings: string[]
  error?: string
}

interface ApprovalResult {
  mode: 'preview' | 'commit'
  totalRows: number
  duplicateRows: number
  rejected: { rowNumber: number, email: string, errors: string[] }[]
  summary: {
    people: number
    approve: number
    alreadyApproved: number
    noVolunteerProfile: number
    notFound: number
    withWarnings: number
    failed: number
  }
  people: ApprovalReport[]
}

const fileName = ref('')
const csvText = ref('')
const pending = ref(false)
const errorMessage = ref('')
const result = ref<ApprovalResult | null>(null)

type Filter = 'all' | 'approve' | 'warnings' | 'unmatched'

const filter = ref<Filter>('all')

const FILTERS: { id: Filter, label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'approve', label: 'To approve' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'unmatched', label: 'Not matched' },
]

const committed = computed(() => result.value?.mode === 'commit')

const ACTION_LABELS = computed<Record<ApprovalAction, string>>(() => ({
  APPROVE: committed.value ? 'Approved' : 'Will approve',
  ALREADY_APPROVED: 'Already approved',
  NO_VOLUNTEER_PROFILE: 'No volunteer application',
  NOT_FOUND: 'No account',
}))

const ACTION_COLORS: Record<ApprovalAction, string> = {
  APPROVE: 'success',
  ALREADY_APPROVED: 'neutral',
  NO_VOLUNTEER_PROFILE: 'warning',
  NOT_FOUND: 'error',
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

async function run(commit: boolean) {
  if (!csvText.value) return
  pending.value = true
  errorMessage.value = ''

  try {
    result.value = await $fetch<ApprovalResult>('/api/admin/ingest/approvals', {
      method: 'POST',
      body: { csv: csvText.value, commit },
    })
  }
  catch (error) {
    const e = error as { statusMessage?: string, data?: { statusMessage?: string }, message?: string }
    errorMessage.value = e.data?.statusMessage ?? e.statusMessage ?? e.message ?? 'The approval failed.'
  }
  finally {
    pending.value = false
  }
}

const visiblePeople = computed(() => {
  const people = result.value?.people ?? []
  if (filter.value === 'approve') return people.filter(p => p.action === 'APPROVE')
  if (filter.value === 'warnings') return people.filter(p => p.warnings.length > 0 || p.error)
  if (filter.value === 'unmatched') return people.filter(p => p.action === 'NOT_FOUND' || p.action === 'NO_VOLUNTEER_PROFILE')
  return people
})

const approvedCount = computed(() => {
  const summary = result.value?.summary
  return summary ? summary.approve - summary.failed : 0
})
</script>

<template>
  <PageContainer width="wide">
    <div class="flex flex-col gap-6">
      <header>
        <h1 class="text-2xl font-semibold">
          Batch volunteer approval
        </h1>
        <p class="mt-1 text-sm text-muted">
          Upload a CSV of volunteers who have passed training. They are matched to accounts by
          email address, and nobody is approved until you review the preview and confirm.
        </p>
      </header>

      <UCard>
        <div class="flex flex-col gap-4">
          <UFormField
            label="CSV file"
            :description="fileName ? `Loaded ${fileName}` : 'A .csv with an email column. A name column is optional and only used for checking.'"
          >
            <input
              type="file"
              accept=".csv,text/csv"
              class="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-inverted"
              @change="onFile"
            >
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
              v-if="result && !committed && result.summary.approve > 0"
              color="primary"
              variant="solid"
              :loading="pending"
              icon="i-lucide-user-check"
              @click="run(true)"
            >
              Approve {{ result.summary.approve }} volunteer{{ result.summary.approve === 1 ? '' : 's' }}
            </UButton>
          </div>

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
          :title="result.summary.failed > 0 ? 'Approved with failures' : 'Approved'"
          :description="`${approvedCount} volunteer(s) approved. ${result.summary.failed} failed.`"
        />

        <UAlert
          v-if="result.summary.notFound + result.summary.noVolunteerProfile > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-user-x"
          title="Some people on the list could not be matched"
          :description="`${result.summary.notFound} have no account under that email and ${result.summary.noVolunteerProfile} have an account but no volunteer application. They are skipped — nothing is created for them here.`"
        />

        <UCard v-if="result.rejected.length">
          <template #header>
            <h2 class="font-medium text-error">
              {{ result.rejected.length }} row(s) cannot be read
            </h2>
          </template>
          <ul class="flex flex-col gap-1 text-sm">
            <li
              v-for="row in result.rejected"
              :key="row.rowNumber"
            >
              <span class="font-mono text-xs text-muted">row {{ row.rowNumber }}</span>
              {{ row.email || '(no email)' }} — {{ row.errors.join(' ') }}
            </li>
          </ul>
        </UCard>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <UCard
            v-for="stat in [
              { label: 'Rows in file', value: result.totalRows },
              { label: committed ? 'Approved' : 'To approve', value: committed ? approvedCount : result.summary.approve },
              { label: 'Already approved', value: result.summary.alreadyApproved },
              { label: 'Not matched', value: result.summary.notFound + result.summary.noVolunteerProfile },
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

        <p
          v-if="result.duplicateRows > 0"
          class="text-xs text-muted"
        >
          {{ result.duplicateRows }} row(s) repeated an email already on the list and were counted once.
        </p>

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
            <table class="w-full min-w-2xl text-left text-sm">
              <thead class="border-b border-default text-xs uppercase text-muted">
                <tr>
                  <th class="px-4 py-2 font-medium">
                    On the list
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Account
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Action
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="person in visiblePeople"
                  :key="person.email"
                  class="border-b border-default/60 align-top"
                >
                  <td class="px-4 py-3">
                    <p class="font-medium">
                      {{ person.listedName ?? '(no name)' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ person.email }}
                    </p>
                    <p class="font-mono text-xs text-muted">
                      row {{ person.rowNumber }}
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <p>{{ person.accountName ?? '—' }}</p>
                    <p
                      v-if="person.currentStatus"
                      class="text-xs text-muted"
                    >
                      was {{ person.currentStatus }}
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="ACTION_COLORS[person.action] as never"
                      variant="subtle"
                      size="sm"
                    >
                      {{ ACTION_LABELS[person.action] }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-1 text-xs">
                      <p
                        v-for="warning in person.warnings"
                        :key="warning"
                        class="text-warning"
                      >
                        {{ warning }}
                      </p>
                      <p
                        v-if="person.error"
                        class="text-error"
                      >
                        Failed: {{ person.error }}
                      </p>
                    </div>
                  </td>
                </tr>
                <tr v-if="!visiblePeople.length">
                  <td
                    colspan="4"
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
