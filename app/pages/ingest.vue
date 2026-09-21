<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'secondary',
  backText: 'Admin',
  backTo: '/admin',
})

/**
 * Bulk import of a volunteer-application CSV export.
 *
 * Deliberately unlinked: nothing in the navigation points here, and it is not
 * under `/admin`. That is presentation only — the access check that matters is
 * `requireRole(event, 'admin')` inside `/api/admin/ingest/volunteers`, with
 * `auth.global.ts` adding the `/ingest` prefix so the page itself doesn't
 * render for anyone else. An unlisted URL is not a permission.
 *
 * The flow is preview-then-commit, against one endpoint: the preview is the
 * same parse and plan the commit runs, so what the table shows is what will be
 * written. Nobody should be pushing 300 rows of other people's demographic
 * data into the database off a file they haven't looked at the interpretation
 * of.
 */

interface ApplicantReport {
  email: string
  name: string | null
  phone: string | null
  action: 'CREATE' | 'LINK_EXISTING_USER' | 'KEEP_EXISTING_VOLUNTEER' | 'ALREADY_IMPORTED'
  approvalStatus: 'PENDING' | 'APPROVED'
  submissionCount: number
  newSubmissionCount: number
  firstSubmittedAt: string | null
  lastSubmittedAt: string | null
  ethinicity: string | null
  ethinicityRaw: string | null
  languages: string[]
  languagesRaw: string | null
  volunteerAreas: string[]
  certifications: string[]
  availabilities: string[]
  emergencyContactName1: string | null
  emergencyContactPhone1: string | null
  warnings: string[]
  error?: string
}

interface IngestResult {
  mode: 'preview' | 'commit'
  totalRows: number
  missingColumns: string[]
  rejected: { rowNumber: number, email: string, errors: string[] }[]
  summary: {
    applicants: number
    create: number
    linkExistingUser: number
    keepExistingVolunteer: number
    alreadyImported: number
    newSubmissions: number
    approved: number
    withWarnings: number
    failed: number
  }
  applicants: ApplicantReport[]
}

const fileName = ref('')
const csvText = ref('')
const pending = ref(false)
const errorMessage = ref('')
const result = ref<IngestResult | null>(null)
const filter = ref<'all' | 'warnings' | 'new' | 'existing'>('all')

const ACTION_LABELS: Record<ApplicantReport['action'], string> = {
  CREATE: 'New account + profile',
  LINK_EXISTING_USER: 'Existing account, new profile',
  KEEP_EXISTING_VOLUNTEER: 'Existing profile kept',
  ALREADY_IMPORTED: 'Already imported',
}

const ACTION_COLORS: Record<ApplicantReport['action'], string> = {
  CREATE: 'success',
  LINK_EXISTING_USER: 'info',
  KEEP_EXISTING_VOLUNTEER: 'warning',
  ALREADY_IMPORTED: 'neutral',
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
    result.value = await $fetch<IngestResult>('/api/admin/ingest/volunteers', {
      method: 'POST',
      body: { csv: csvText.value, commit },
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

const visibleApplicants = computed(() => {
  const applicants = result.value?.applicants ?? []
  if (filter.value === 'warnings') return applicants.filter(a => a.warnings.length > 0 || a.error)
  if (filter.value === 'new') return applicants.filter(a => a.action === 'CREATE')
  if (filter.value === 'existing') return applicants.filter(a => a.action !== 'CREATE')
  return applicants
})

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Chicago' })
}
</script>

<template>
  <PageContainer width="wide">
    <div class="flex flex-col gap-6">
      <header>
        <h1 class="text-2xl font-semibold">
          Volunteer application import
        </h1>
        <p class="mt-1 text-sm text-muted">
          Upload a volunteer application CSV export. Nothing is written until you review the
          preview and choose to import.
        </p>
      </header>

      <UCard>
        <div class="flex flex-col gap-4">
          <UFormField
            label="CSV file"
            :description="fileName ? `Loaded ${fileName}` : 'A .csv export of the volunteer application form.'"
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
              v-if="result && !committed && result.summary.newSubmissions > 0"
              color="primary"
              variant="solid"
              :loading="pending"
              icon="i-lucide-database"
              @click="run(true)"
            >
              Import {{ result.summary.newSubmissions }} submission{{ result.summary.newSubmissions === 1 ? '' : 's' }}
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
          :title="result.summary.failed > 0 ? 'Imported with failures' : 'Imported'"
          :description="`${result.summary.newSubmissions} submission(s) written across ${result.summary.applicants} applicant(s). ${result.summary.failed} failed.`"
        />

        <UAlert
          v-if="result.missingColumns.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-columns-3"
          title="Columns not found in this file"
          :description="`${result.missingColumns.join(', ')} — those fields will be empty for every row.`"
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
              {{ row.email || '(no email)' }} — {{ row.errors.join(' ') }}
            </li>
          </ul>
        </UCard>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <UCard
            v-for="stat in [
              { label: 'Rows in file', value: result.totalRows },
              { label: 'People', value: result.summary.applicants },
              { label: committed ? 'Submissions written' : 'Submissions to write', value: result.summary.newSubmissions },
              { label: 'With warnings', value: result.summary.withWarnings },
              { label: 'New accounts', value: result.summary.create },
              { label: 'Existing accounts', value: result.summary.linkExistingUser },
              { label: 'Profiles kept as-is', value: result.summary.keepExistingVolunteer },
              { label: 'Approved on import', value: result.summary.approved },
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
              <UButtonGroup size="xs">
                <UButton
                  v-for="option in [
                    { id: 'all', label: 'All' },
                    { id: 'warnings', label: 'Warnings' },
                    { id: 'new', label: 'New' },
                    { id: 'existing', label: 'Existing' },
                  ]"
                  :key="option.id"
                  :variant="filter === option.id ? 'solid' : 'outline'"
                  @click="filter = option.id as typeof filter"
                >
                  {{ option.label }}
                </UButton>
              </UButtonGroup>
            </div>
          </template>

          <div class="overflow-x-auto">
            <table class="w-full min-w-3xl text-left text-sm">
              <thead class="border-b border-default text-xs uppercase text-muted">
                <tr>
                  <th class="px-4 py-2 font-medium">
                    Applicant
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Action
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Status
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Submitted
                  </th>
                  <th class="px-4 py-2 font-medium">
                    Mapped
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="applicant in visibleApplicants"
                  :key="applicant.email"
                  class="border-b border-default/60 align-top"
                >
                  <td class="px-4 py-3">
                    <p class="font-medium">
                      {{ applicant.name ?? '(no name)' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ applicant.email }}
                    </p>
                    <p
                      v-if="applicant.phone"
                      class="text-xs text-muted"
                    >
                      {{ applicant.phone }}
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="ACTION_COLORS[applicant.action] as never"
                      variant="subtle"
                      size="sm"
                    >
                      {{ ACTION_LABELS[applicant.action] }}
                    </UBadge>
                    <p
                      v-if="applicant.submissionCount > 1"
                      class="mt-1 text-xs text-muted"
                    >
                      {{ applicant.submissionCount }} submissions, {{ applicant.newSubmissionCount }} new
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <UBadge
                      :color="applicant.approvalStatus === 'APPROVED' ? 'success' : 'neutral'"
                      variant="subtle"
                      size="sm"
                    >
                      {{ applicant.approvalStatus }}
                    </UBadge>
                  </td>
                  <td class="px-4 py-3 text-xs text-muted">
                    {{ formatDate(applicant.lastSubmittedAt) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-1 text-xs">
                      <p>
                        <span class="text-muted">Ethnicity:</span>
                        {{ applicant.ethinicity ?? '—' }}
                        <span
                          v-if="applicant.ethinicityRaw"
                          class="text-muted"
                        >({{ applicant.ethinicityRaw }})</span>
                      </p>
                      <p>
                        <span class="text-muted">Languages:</span>
                        {{ applicant.languages.length ? applicant.languages.join(', ') : '—' }}
                        <span
                          v-if="applicant.languagesRaw"
                          class="text-muted"
                        >({{ applicant.languagesRaw }})</span>
                      </p>
                      <p>
                        <span class="text-muted">Areas:</span>
                        {{ applicant.volunteerAreas.join(', ') || '—' }}
                      </p>
                      <p>
                        <span class="text-muted">Availability:</span>
                        {{ applicant.availabilities.join(', ') || '—' }}
                      </p>
                      <p>
                        <span class="text-muted">Emergency:</span>
                        {{ [applicant.emergencyContactName1, applicant.emergencyContactPhone1].filter(Boolean).join(' · ') || '—' }}
                      </p>
                      <p
                        v-for="warning in applicant.warnings"
                        :key="warning"
                        class="text-warning"
                      >
                        {{ warning }}
                      </p>
                      <p
                        v-if="applicant.error"
                        class="text-error"
                      >
                        Failed: {{ applicant.error }}
                      </p>
                    </div>
                  </td>
                </tr>
                <tr v-if="!visibleApplicants.length">
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
