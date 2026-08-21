<script setup lang="ts">
/**
 * Editor for the two reporting settings that shouldn't be hardcoded: the
 * dollar value of a volunteer hour, and how long someone can go quiet before
 * the lapse list picks them up.
 *
 * The rate is the one that matters. Independent Sector republishes it every
 * year, grant reports are checked against the published figure, and a rate
 * frozen into a deploy is a number nobody can correct when it changes — so it
 * lives in the database with its source recorded next to it.
 */

interface ReportingSettings {
  volunteerHourlyRate: number
  volunteerHourlyRateSource: string
  lapseThresholdDays: number
  usingDefaults: boolean
  updatedAt: string | null
  defaults: { volunteerHourlyRate: number, lapseThresholdDays: number }
}

const emit = defineEmits<{ saved: [] }>()

const { data: settings, refresh } = await useFetch<ReportingSettings>(
  '/api/admin/reports/settings',
  { headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined },
)

const draft = reactive({
  volunteerHourlyRate: settings.value?.volunteerHourlyRate ?? 0,
  volunteerHourlyRateSource: settings.value?.volunteerHourlyRateSource ?? '',
  lapseThresholdDays: settings.value?.lapseThresholdDays ?? 60,
})

// Re-seed if the fetch resolves after this component set up its draft.
watch(settings, (next) => {
  if (!next) return
  draft.volunteerHourlyRate = next.volunteerHourlyRate
  draft.volunteerHourlyRateSource = next.volunteerHourlyRateSource
  draft.lapseThresholdDays = next.lapseThresholdDays
})

const saving = ref(false)
const error = ref<string | null>(null)
const saved = ref(false)

async function save() {
  saving.value = true
  error.value = null
  saved.value = false

  try {
    await $fetch('/api/admin/reports/settings', { method: 'PUT', body: { ...draft } })
    await refresh()
    saved.value = true
    // The rate feeds every dollar figure on the funder report, so the page has
    // to refetch rather than keep showing totals built from the old one.
    emit('saved')
  }
  catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Could not save these settings.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section
    class="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm"
  >
    <h2 class="text-base sm:text-lg font-bold text-[#313131] dark:text-white">
      Report settings
    </h2>
    <p class="text-xs sm:text-sm font-medium text-slate-600 dark:text-gray-400 mt-0.5">
      The hourly rate drives every in-kind value on the impact report. Update it when
      Independent Sector publishes a new figure.
    </p>

    <div class="grid sm:grid-cols-2 gap-4 mt-4">
      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
          Volunteer hourly rate (USD)
        </span>
        <input
          v-model.number="draft.volunteerHourlyRate"
          type="number"
          step="0.01"
          min="0"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-2"
        >
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
          Rate source (cited on the report)
        </span>
        <input
          v-model="draft.volunteerHourlyRateSource"
          type="text"
          maxlength="200"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-2"
        >
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
          Lapse threshold (days quiet)
        </span>
        <input
          v-model.number="draft.lapseThresholdDays"
          type="number"
          min="7"
          max="730"
          step="1"
          class="rounded-lg border border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-slate-900 dark:text-white px-3 py-2"
        >
      </label>
    </div>

    <div class="flex items-center gap-3 mt-4">
      <UButton
        color="brand4"
        size="sm"
        :loading="saving"
        @click="save"
      >
        Save settings
      </UButton>

      <span
        v-if="saved"
        class="text-xs font-semibold text-[var(--viz-good)]"
      >Saved.</span>
      <span
        v-else-if="error"
        class="text-xs font-semibold text-[var(--viz-critical)]"
      >{{ error }}</span>
      <span
        v-else-if="settings?.usingDefaults"
        class="text-xs font-medium text-slate-500 dark:text-gray-400"
      >
        Still on the built-in defaults — confirm the rate before sending a grant report.
      </span>
    </div>
  </section>
</template>
