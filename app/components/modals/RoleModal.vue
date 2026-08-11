<script setup lang="ts">
/**
 * Prompts for a single role, used by the admin member screens for both
 * granting and revoking (the caller supplies the eligible `roles` list and the
 * button label).
 *
 * Unlike `ConfirmModal` this closes itself on confirm rather than waiting on
 * the parent, so it has no loading state — the caller handles failures with a
 * toast rather than in the dialog.
 */
const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  roles: string[];
  confirmLabel?: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [role: string];
}>();

const selectedRole = ref<string | null>(null);

// Clear the selection each time the dialog opens — the component stays mounted
// between uses, so without this it would reopen showing the previous choice.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) selectedRole.value = null;
  }
);

function handleConfirm() {
  if (!selectedRole.value) return;

  emit('confirm', selectedRole.value);
  emit('update:open', false);
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="font-normal text-sm text-gray-400">
          {{ description }}
        </p>

        <USelectMenu
          v-model="selectedRole"
          :items="roles"
          placeholder="Select a role"
          class="w-full"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          :label="confirmLabel ?? 'Confirm'"
          :disabled="!selectedRole"
          @click="handleConfirm"
        />

        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>