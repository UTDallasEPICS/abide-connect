<script setup lang="ts">
import { ref, watch } from "vue"

const props = defineProps<{
  event: any
}>()

const emit = defineEmits(["save", "delete"])

const editedEvent = ref<any>({})
const filesToUpload = ref<File[]>([])
// Build asset list for the uploader from the real event assets
const eventAssets = ref<{ imageUrl: string; isPreview?: boolean; fileName?: string }[]>([])

watch(() => props.event, (newEvent) => {
  if (newEvent) {
    editedEvent.value = { ...newEvent }
    // Map existing server assets to uploader format
    // imageUrl in DB is just the fileName (after the upload fix)
    eventAssets.value = (newEvent.eventAssets || []).map((a: any) => ({
      imageUrl: `/api/events/${newEvent.id}/images/${a.imageUrl}`,
      fileName: a.imageUrl,
      isPreview: false,
    }))
  }
}, { immediate: true })

function onFilesChanged(files: File[]) {
  filesToUpload.value = files
}

async function saveEvent() {
  // Upload any pending files first
  if (filesToUpload.value.length > 0) {
    for (const file of filesToUpload.value) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        await $fetch(`/api/events/${editedEvent.value.id}/images/upload`, {
          method: 'POST',
          body: formData
        })
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }
    filesToUpload.value = []
  }

  emit("save", { ...editedEvent.value })
}

function deleteEvent() {
  emit("delete", editedEvent.value.id)
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-xl font-semibold">Edit Event</h3>

    <UFormGroup label="Event Title">
      <UInput v-model="editedEvent.title" placeholder="Event title" />
    </UFormGroup>

    <UFormGroup label="Short Description">
      <UInput v-model="editedEvent.shortDesc" placeholder="Brief description" />
    </UFormGroup>

    <UFormGroup label="Full Description">
      <UTextarea v-model="editedEvent.description" :rows="4" placeholder="Full description" />
    </UFormGroup>

    <UFormGroup label="Location">
      <UInput v-model="editedEvent.location.address" placeholder="Location address" />
    </UFormGroup>

    <div class="grid grid-cols-2 gap-4">
      <UFormGroup label="Start Date & Time">
        <UInput v-model="editedEvent.startTime" type="datetime-local" />
      </UFormGroup>
      <UFormGroup label="End Date & Time">
        <UInput v-model="editedEvent.endTime" type="datetime-local" />
      </UFormGroup>
    </div>

    <div class="space-y-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <UCheckbox v-model="editedEvent.allowVolunteers" />
        <span class="text-sm font-medium text-gray-700">Allow Volunteers</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <UCheckbox v-model="editedEvent.allowAttendees" />
        <span class="text-sm font-medium text-gray-700">Allow Attendees</span>
      </label>
    </div>

    <UFormGroup label="Event Images">
      <EventImageUpload
        :existing-assets="editedEvent.eventAssets"
        :event-id="editedEvent.id"
        @files-changed="onFilesChanged"
      />
    </UFormGroup>

    <div class="flex justify-between pt-2">
      <UButton color="brand1" variant="soft" @click="deleteEvent">Delete Event</UButton>
      <UButton color="primary" @click="saveEvent">Save Changes</UButton>
    </div>
  </div>
</template>