<script setup lang="ts">
type ApprovalStatusOption = 'PENDING' | 'APPROVED' | 'REJECTED';

const props = defineProps<{
  open: boolean;
  userId: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'created'): void;
}>();

const approvalStatusItems: { label: string; value: ApprovalStatusOption }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
];

const form = reactive({
  eventName: '',
  date: '',
  hours: null as number | null,
  approvalStatus: 'PENDING' as ApprovalStatusOption,
  comment: '',
});

const isSubmitting = ref(false);
const formError = ref<string | null>(null);

function resetForm() {
  form.eventName = '';
  form.date = '';
  form.hours = null;
  form.approvalStatus = 'PENDING';
  form.comment = '';
  formError.value = null;
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
    }
  }
);

function handleOpenUpdate(v: boolean) {
  if (isSubmitting.value) return;
  emit('update:open', v);
}

async function handleSubmit() {
  formError.value = null;

  if (!form.date) {
    formError.value = 'Please select a date.';
    return;
  }
  if (form.hours === null || form.hours <= 0) {
    formError.value = 'Please enter a valid number of hours.';
    return;
  }

  isSubmitting.value = true;
  try {
    await $fetch('/api/hour-log/create', {
      method: 'POST',
      body: {
        userId: props.userId,
        eventName: form.eventName || undefined,
        date: form.date,
        hours: form.hours,
        approvalStatus: form.approvalStatus,
        comment: form.comment || undefined,
      },
    });

    emit('created');
    emit('update:open', false);
  } catch (err: any) {
    formError.value = err?.data?.message ?? err?.message ?? 'Failed to add hour log. Please try again.';
  } finally {
    isSubmitting.value = false;
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
          <label class="text-sm font-medium text-gray-600">Name</label>
          <UInput
            v-model="form.eventName"
            placeholder="Hour log title (optional)"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600">Date</label>
          <UInput v-model="form.date" type="date" class="w-full" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600">Hours</label>
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
          <label class="text-sm font-medium text-gray-600">Approval Status</label>
          <USelect
            v-model="form.approvalStatus"
            :items="approvalStatusItems"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-600">Comment</label>
          <UTextarea
            v-model="form.comment"
            placeholder="Optional comment"
            class="w-full"
          />
        </div>

        <p v-if="formError" class="text-sm text-red-500 font-medium">{{ formError }}</p>
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