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
  <UModal :open="open" :ui="{ overlay: 'bg-black/70' }" @update:open="$emit('update:open', $event)">
    <template #content>
      <div class="p-6 flex flex-col gap-4">
        <div>
          <h3 class="text-lg font-semibold">{{ title }}</h3>
          <p class="text-sm font-normal text-gray-400">{{ description }}</p>
        </div>

        <USelectMenu
          v-model="selectedRole"
          :items="roles"
          placeholder="Select a role"
          class="w-full"
        />

        <div class="flex justify-end gap-2 mt-2">
          <UButton
            :label="confirmLabel ?? 'Confirm'"
            class="font-semibold px-4 rounded-md"
            :disabled="!selectedRole"
            @click="handleConfirm"
          />
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            class="rounded-md    font-semibold px-4"
            @click="$emit('update:open', false)"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>