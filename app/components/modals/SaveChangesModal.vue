<script setup lang="ts">
/**
 * Save-confirmation dialog for the admin member-detail edit form.
 *
 * Like `ConfirmModal`, it won't close while `loading` is set, so the save can't
 * be abandoned mid-request; failures surface as an in-dialog alert so the user
 * can retry without losing their edits.
 */
const props = defineProps<{
  open: boolean;
  loading?: boolean;
  error?: string | null;
}>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();
</script>
<template>
  <UModal :open="open" title="Review changes" @update:open="(v) => !loading && emit('update:open', v)">
    <template #body>
      <p class="font-normal text-sm">Are you sure you want to save these changes? This action can not be undone.</p>
      <UAlert
        v-if="error"
        class="mt-3"
        color="error"
        variant="subtle"
        title="Failed to save changes"
        :description="error"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          label="Save Changes"
          color="primary"
          :loading="loading"
          :disabled="loading"
          @click="emit('confirm')"
        />
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="loading"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>