<script setup lang="ts">
/**
 * EventImageUpload
 *
 * Wraps Nuxt UI's UFileUpload for use in event forms.
 * - Handles multiple image selection with drag & drop
 * - Shows existing server images alongside new uploads
 * - Supports deleting existing images from the server
 */

interface ServerAsset {
  imageUrl: string // just the fileName as stored in DB
}

const props = defineProps<{
  // Existing saved assets from the server (pass event.eventAssets)
  existingAssets?: ServerAsset[]
  // The event ID, needed to build image URLs and delete from server
  eventId?: string
}>()

const emit = defineEmits<{
  // Emits the raw File[] whenever selection changes, for parent to upload on save
  (e: 'filesChanged', files: File[]): void
  // Emits when an existing server image is deleted
  (e: 'assetDeleted', imageUrl: string): void
}>()

// Files selected by the user (not yet uploaded)
const selectedFiles = ref<File[]>([])

// Track which existing assets are still present
const remainingAssets = ref<ServerAsset[]>([...(props.existingAssets || [])])

watch(() => props.existingAssets, (assets) => {
  remainingAssets.value = [...(assets || [])]
}, { deep: true })

function onFilesChanged(files: File[] | null | undefined) {
  const safeFiles = files ?? []
  selectedFiles.value = safeFiles
  emit('filesChanged', safeFiles)
}

async function deleteExistingAsset(asset: ServerAsset) {
  if (!props.eventId) return

  try {
    await $fetch(`/api/events/${props.eventId}/images/${asset.imageUrl}`, {
      method: 'DELETE'
    })
    remainingAssets.value = remainingAssets.value.filter(a => a.imageUrl !== asset.imageUrl)
    emit('assetDeleted', asset.imageUrl)
  } catch (err) {
    console.error('Failed to delete image:', err)
  }
}

function getAssetUrl(asset: ServerAsset) {
  return `/api/events/${props.eventId}/images/${asset.imageUrl}`
}
</script>

<template>
  <div class="space-y-4">
    <!-- Existing server images -->
    <div v-if="remainingAssets.length > 0">
      <p class="text-sm text-gray-500 mb-2">Current Images</p>
      <div class="grid grid-cols-3 gap-2">
        <div
          v-for="asset in remainingAssets"
          :key="asset.imageUrl"
          class="relative group aspect-square rounded-lg overflow-hidden bg-gray-100"
        >
          <img
            :src="getAssetUrl(asset)"
            :alt="asset.imageUrl"
            class="w-full h-full object-cover"
          >
          <button
            class="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow"
            type="button"
            @click="deleteExistingAsset(asset)"
          >
            <UIcon name="i-lucide-trash-2" class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- UFileUpload for new images -->
    <UFileUpload
      v-model="selectedFiles"
      multiple
      accept="image/*"
      variant="area"
      layout="list"
      icon="i-lucide-image"
      label="Drop images here or click to browse"
      description="PNG, JPG, WEBP, GIF supported"
      color="brand4"
      class="w-full min-h-36"
      @update:model-value="onFilesChanged"
    />
  </div>
</template>