<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    confirmColor?: 'primary' | 'error' | 'neutral';
    icon?: string;
  }>(),
  {
    confirmLabel: 'Confirm',
    confirmColor: 'error',
    icon: 'i-lucide-alert-triangle',
  }
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();

function handleConfirm() {
  emit('confirm');
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
      <div class="flex items-start gap-3">
        <UIcon :name="icon" class="text-red-500 text-2xl mt-0.5" />

        <p class="font-normal text-sm text-gray-400">
          {{ description }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          :label="confirmLabel"
          :color="confirmColor"
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