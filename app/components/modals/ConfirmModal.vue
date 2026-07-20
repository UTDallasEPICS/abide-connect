<script setup lang="ts">
withDefaults(
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
  <UModal :open="open" :ui="{ overlay: 'bg-black/70' }" @update:open="$emit('update:open', $event)">
    <template #content>
      <div class="p-6 flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <UIcon :name="icon" class="text-red-500 text-2xl mt-0.5" />
          <div>
            <h3 class="text-lg font-semibold">{{ title }}</h3>
            <p class="text-sm text-gray-400 mt-1">{{ description }}</p>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            class="rounded-full font-semibold px-4"
            @click="$emit('update:open', false)"
          />
          <UButton
            :label="confirmLabel"
            :color="confirmColor"
            class="rounded-full font-semibold px-4"
            @click="handleConfirm"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>