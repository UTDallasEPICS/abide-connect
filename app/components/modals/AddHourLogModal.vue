<script setup lang="ts">
import { roundHours } from '#shared/utils/hours'

/**
 * Logs hours on a member's behalf, from the admin member-detail page.
 *
 * Differs from the volunteer-facing `components/volunteer/HourLogModal.vue` in
 * two ways: it takes an explicit `userId` rather than using the session, and it
 * can set `approvalStatus` directly, so staff can record already-approved
 * hours without a second review step.
 *
 * Posts to `/api/hour-log`, which resolves the `userId` to its `Volunteer`
 * record and 404s if the member never applied to volunteer.
 */
type ApprovalStatusOption = 'PENDING' | 'APPROVED' | 'REJECTED'

const props = defineProps<{
  open: boolean
  userId: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created'): void
}>()

const approvalStatusItems: { label: string, value: ApprovalStatusOption }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
]

const form = reactive({
  eventName: '',
  date: '',
  hours: null as number | null,
  approvalStatus: 'PENDING' as ApprovalStatusOption,
  comment: '',
})

const isSubmitting = ref(false)
const formError = ref<string | null>(null)

function resetForm() {
  form.eventName = ''
  form.date = ''
  form.hours = null
  form.approvalStatus = 'PENDING'
  form.comment = ''
  formError.value = null
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm()
    }
  },
)

function handleOpenUpdate(v: boolean) {
  if (isSubmitting.value) return
  emit('update:open', v)
}

async function handleSubmit() {
  formError.value = null

  if (!form.date) {
    formError.value = 'Please select a date.'
    return
  }
  // Snapped to two decimals in the field itself, so what the admin sees before
  // submitting is what gets stored — the API rounds too, but silently.
  const hours = form.hours === null ? null : roundHours(form.hours)

  if (hours === null || !Number.isFinite(hours) || hours <= 0) {
    formError.value = 'Please enter a valid number of hours.'
    return
  }

  form.hours = hours

  isSubmitting.value = true
  try {
    await $fetch('/api/hour-log/create', {
      method: 'POST',
      body: {
        userId: props.userId,
        eventName: form.eventName || undefined,
        date: form.date,
        hours,
        approvalStatus: form.approvalStatus,
        comment: form.comment || undefined,
      },
    })

    emit('created')
    emit('update:open', false)
  }
  catch (err) {
    const errorBody = err as { data?: { message?: string }, message?: string }
    formError.value = errorBody.data?.message ?? errorBody.message ?? 'Failed to add hour log. Please try again.'
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="Add Hour Log"
    @update:open="handleOpenUpdate"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Name</label>
          <UInput
            v-model="form.eventName"
            placeholder="Hour log title (optional)"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Date</label>
          <UInput
            v-model="form.date"
            type="date"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Hours</label>
          <UInput
            v-model.number="form.hours"
            type="number"
            step="0.25"
            min="0"
            placeholder="e.g. 3.5"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Approval Status</label>
          <USelect
            v-model="form.approvalStatus"
            :items="approvalStatusItems"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600 dark:text-gray-300">Comment</label>
          <UTextarea
            v-model="form.comment"
            placeholder="Optional comment"
            class="w-full"
          />
        </div>

        <p
          v-if="formError"
          class="text-sm text-red-500 dark:text-red-400 font-medium"
        >
          {{ formError }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Add"
          color="primary"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="handleSubmit"
        />
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="isSubmitting"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>
