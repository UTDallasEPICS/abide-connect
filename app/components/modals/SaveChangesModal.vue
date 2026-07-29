<script setup lang="ts">
const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();
</script>

<template>
  <UModal :open="open" title="Review changes" @update:open="(v) => emit('update:open', v)">
    <template #body>
        <p class="font-normal text-sm">Are you sure you want to save these changes? This action can not be undone.</p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Save Changes" color="primary" @click="emit('confirm')" />
        <UButton label="Cancel" color="neutral" variant="ghost" @click="emit('update:open', false)" />
      </div>
    </template>
  </UModal>
</template>