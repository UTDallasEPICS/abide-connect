<script setup lang="ts">
/**
 * Lets a volunteer log their own hours, from their profile page.
 *
 * No status field: submissions are always created PENDING for staff to review
 * (`/api/volunteer-logs`), and the log is attached to whatever volunteer owns
 * the session — there's no user to choose.
 *
 * The admin counterpart, which logs hours on someone else's behalf and can set
 * the status directly, is `components/modals/AddHourLogModal.vue`.
 */
const emit = defineEmits(['save', 'close'])

const form = ref({
  eventName: '',
  date: '',
  hours: null as number | null,
  comment: '',
})

const isSubmitting = ref(false)
const errorMsg = ref<string | null>(null)

async function submitLog() {
  if (!form.value.date || !form.value.hours) {
    errorMsg.value = 'Date and hours are required'
    return
  }

  if (form.value.hours > 1000 || form.value.hours <= 0) {
    errorMsg.value = 'Hours must be between 1 and 1000'
    return
  }

  isSubmitting.value = true
  errorMsg.value = null

  try {
    await $fetch('/api/volunteer-logs', {
      method: 'POST' as const,
      body: {
        eventName: form.value.eventName || null,
        date: form.value.date,
        hours: form.value.hours,
        comment: form.value.comment || null,
      },
    })
    emit('save')
  }
  catch (err) {
    console.error('Failed to submit log:', err)
    errorMsg.value = 'Failed to submit. Please try again.'
  }
  finally {
    isSubmitting.value = false
  }
}

function cancel() {
  emit('close')
}
</script>

<template>
  <div class="space-y-5 p-6">
    <h3 class="text-xl font-semibold text-[#3D3745] dark:text-white">
      Log Your Hours
    </h3>

    <!-- Event Name (optional) -->
    <div>
      <label class="block text-sm font-medium text-[#3D3745] dark:text-gray-200 mb-1">
        Event Name <span class="text-gray-400 text-xs">(optional)</span>
      </label>
      <UInput
        v-model="form.eventName"
        placeholder="What event did you volunteer at?"
        class="w-full"
      />
    </div>

    <!-- Date -->
    <div>
      <label class="block text-sm font-medium text-[#3D3745] dark:text-gray-200 mb-1">
        Date <span class="text-[#A4123F]">*</span>
      </label>
      <UInput
        v-model="form.date"
        type="date"
        class="w-full"
      />
    </div>

    <!-- Hours -->
    <div>
      <label class="block text-sm font-medium text-[#3D3745] dark:text-gray-200 mb-1">
        Hours <span class="text-[#A4123F]">*</span>
      </label>
      <UInput
        v-model="form.hours"
        type="number"
        placeholder="How many hours did you volunteer?"
        :min="1"
        :max="1000"
        class="w-full"
      />
    </div>

    <!-- Comment -->
    <div>
      <label class="block text-sm font-medium text-[#3D3745] dark:text-gray-200 mb-1">
        Comment <span class="text-gray-400 text-xs">(optional)</span>
      </label>
      <UTextarea
        v-model="form.comment"
        placeholder="Any additional notes..."
        :rows="3"
        class="w-full"
      />
    </div>

    <!-- Error -->
    <p
      v-if="errorMsg"
      class="text-sm text-[#A4123F]"
    >
      {{ errorMsg }}
    </p>

    <!-- Buttons -->
    <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
      <UButton
        variant="ghost"
        color="neutral"
        :disabled="isSubmitting"
        @click="cancel"
      >
        Cancel
      </UButton>
      <UButton
        :loading="isSubmitting"
        color="brand4"
        @click="submitLog"
      >
        {{ isSubmitting ? 'Submitting...' : 'Submit Hours' }}
      </UButton>
    </div>
  </div>
</template>
