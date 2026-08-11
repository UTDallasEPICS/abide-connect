<script setup lang="ts">
/**
 * Generic "are you sure?" dialog, defaulting to destructive styling since
 * that's what most confirmations here are (delete user, remove image, …).
 *
 * The parent owns the async work and feeds `loading` and `error` back in;
 * while `loading` is set the modal refuses to close, including via backdrop
 * click or Escape, so an in-flight request can't be abandoned halfway.
 */
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  confirmColor?: 'primary' | 'error' | 'neutral' | 'warning' | 'success'
  icon?: string
  loading?: boolean
  error?: string | null
}>(), {
  confirmLabel: 'Confirm',
  confirmColor: 'error',
  icon: 'i-lucide-alert-triangle',
  loading: false,
  error: null,
})
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
}>()
function handleConfirm() {
  emit('confirm')
}
function handleOpenUpdate(v: boolean) {
  if (props.loading) return
  emit('update:open', v)
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    @update:open="handleOpenUpdate"
  >
    <template #body>
      <div class="flex items-start gap-3">
        <UIcon
          :name="icon"
          class="text-red-700 text-2xl mt-0.5"
        />
        <div class="flex flex-col gap-1">
          <p class="font-normal text-sm text-gray-400">
            {{ description }}
          </p>
          <p
            v-if="error"
            class="text-sm text-red-700 font-medium"
          >
            {{ error }}
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          :label="confirmLabel"
          :color="confirmColor"
          :loading="loading"
          :disabled="loading"
          :ui="{ base: 'bg-red-700 hover:bg-red-800 active:bg-red-900 focus-visible:outline-red-700' }"
          @click="handleConfirm"
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
