<script setup lang="ts">
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