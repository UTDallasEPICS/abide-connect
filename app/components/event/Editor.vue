<script setup lang="ts">
import { ref, watch } from 'vue'
import { eventTypeFromFlags } from '#shared/utils/eventType'

/**
 * Event edit form. Owns a local copy of the event and emits `save`/`delete` —
 * the parent performs the actual writes.
 *
 * Edits are made against `editedEvent`, a clone rebuilt whenever the `event`
 * prop changes, so abandoning the form leaves the original untouched.
 *
 * Note images do not follow that pattern: `saveEvent` uploads pending files
 * immediately, before emitting, so a user who uploads and then cancels has
 * still changed the event's images.
 */

const props = defineProps({
  event: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['save', 'delete'])

const editedEvent = ref<any>({})
const filesToUpload = ref<File[]>([])
// Build asset list for the uploader from the real event assets
const eventAssets = ref<{ imageUrl: string, isPreview?: boolean, fileName?: string }[]>([])

watch(() => props.event, (newEvent) => {
  if (newEvent) {
    // The stored audience booleans become one exclusive event type.
    editedEvent.value = { ...newEvent, eventType: eventTypeFromFlags(newEvent) }
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
          body: formData,
        })
      }
      catch (err) {
        // Swallowed deliberately so one bad image doesn't lose the user's text
        // edits — but nothing surfaces the failure, so the save appears to
        // succeed with the image missing. Worth a toast.
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }
    filesToUpload.value = []
  }

  emit('save', { ...editedEvent.value })
}

function deleteEvent() {
  emit('delete', editedEvent.value.id)
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-xl font-semibold">
      Edit Event
    </h3>

    <UFormGroup label="Event Title">
      <UInput
        v-model="editedEvent.title"
        placeholder="Event title"
      />
    </UFormGroup>

    <UFormGroup label="Short Description">
      <UInput
        v-model="editedEvent.shortDesc"
        placeholder="Brief description"
      />
    </UFormGroup>

    <UFormGroup label="Full Description">
      <UTextarea
        v-model="editedEvent.description"
        :rows="4"
        placeholder="Full description"
      />
    </UFormGroup>

    <UFormGroup label="Location">
      <UInput
        v-model="editedEvent.location.address"
        placeholder="Location address"
      />
    </UFormGroup>

    <div class="grid grid-cols-2 gap-4">
      <UFormGroup label="Start Date & Time">
        <UInput
          v-model="editedEvent.startTime"
          type="datetime-local"
        />
      </UFormGroup>
      <UFormGroup label="End Date & Time">
        <UInput
          v-model="editedEvent.endTime"
          type="datetime-local"
        />
      </UFormGroup>
    </div>

    <EventTypeSelector v-model="editedEvent.eventType" />

    <UFormGroup label="Event Images">
      <EventImageUpload
        :existing-assets="editedEvent.eventAssets"
        :event-id="editedEvent.id"
        @files-changed="onFilesChanged"
      />
    </UFormGroup>

    <div class="flex justify-between pt-2">
      <UButton
        color="red"
        variant="soft"
        @click="deleteEvent"
      >
        Delete Event
      </UButton>
      <UButton
        color="primary"
        @click="saveEvent"
      >
        Save Changes
      </UButton>
    </div>
  </div>
</template>
