<script setup lang="ts">
import { ref } from "vue"

const emit = defineEmits(["save", "close"])

const newEvent = ref({
  title: "",
  shortDesc: "",
  description: "",
  location: "",
  startTime: "",
  endTime: "",
  allowVolunteers: false,
  allowAttendees: false,
  mobileClinicId: null,
})

// Assets shown in the uploader (previews before save)
const eventAssets = ref<{ imageUrl: string; isPreview?: boolean; fileName?: string }[]>([])
// Raw File objects to upload after event is created
const filesToUpload = ref<File[]>([])

const isSaving = ref(false)

function onFilesChanged(files: File[]) {
  filesToUpload.value = files
}

async function saveEvent() {
  if (!newEvent.value.title || !newEvent.value.startTime || !newEvent.value.endTime) {
    alert('Please fill in all required fields (Title, Start Time, End Time)')
    return
  }

  isSaving.value = true

  try {
    // Step 1: Create the event
    const response = await $fetch('/api/events', {
      method: 'POST',
      body: {
        title: newEvent.value.title,
        shortDesc: newEvent.value.shortDesc,
        description: newEvent.value.description,
        location: newEvent.value.location,
        startTime: new Date(newEvent.value.startTime).toISOString(),
        endTime: new Date(newEvent.value.endTime).toISOString(),
        allowVolunteers: newEvent.value.allowVolunteers,
        allowAttendees: newEvent.value.allowAttendees,
        mobileClinicId: newEvent.value.mobileClinicId
      }
    })

    // Step 2: Upload images
    if (response.id && filesToUpload.value.length > 0) {
      for (const file of filesToUpload.value) {
        const formData = new FormData()
        formData.append('file', file)
        try {
          await $fetch(`/api/events/${response.id}/images/upload`, {
            method: 'POST',
            body: formData
          })
        } catch (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError)
        }
      }
    }

    // Step 3: Fetch complete event with images
    const completeEvent = await $fetch(`/api/events/${response.id}`)
    emit("save", completeEvent)

    // Reset form
    newEvent.value = {
      title: "", shortDesc: "", description: "", location: "",
      startTime: "", endTime: "", allowVolunteers: false,
      allowAttendees: false, mobileClinicId: null,
    }
    eventAssets.value = []
    filesToUpload.value = []

  } catch (error: any) {
    console.error('Error creating event:', error)
    alert(`Error creating event: ${error.message || 'Please try again.'}`)
  } finally {
    isSaving.value = false
  }
}

function cancel() {
  emit("close")
}
</script>

<template>
  <div class="space-y-4 p-6 max-h-[80vh] overflow-y-auto">
    <h3 class="text-xl font-semibold mb-4">Add New Event</h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Event Title <span class="text-red-500">*</span>
      </label>
      <UInput v-model="newEvent.title" placeholder="Enter event title" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
      <UInput v-model="newEvent.shortDesc" placeholder="Brief description" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
      <UTextarea v-model="newEvent.description" placeholder="Detailed description" :rows="4" />
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
      <UInput v-model="newEvent.location" placeholder="Enter location address" />
    </div>

    >
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Start Date & Time <span class="text-red-500">*</span>
        </label>
        <UInput v-model="newEvent.startTime" type="datetime-local" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          End Date & Time <span class="text-red-500">*</span>
        </label>
        <UInput v-model="newEvent.endTime" type="datetime-local" />
      </div>
  

    <div class="space-y-2">
      <label class="flex items-center gap-2 cursor-pointer">
        <UCheckbox v-model="newEvent.allowVolunteers" />
        <span class="text-sm font-medium text-gray-700">Allow Volunteers</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <UCheckbox v-model="newEvent.allowAttendees" />
        <span class="text-sm font-medium text-gray-700">Allow Attendees to Register</span>
      </label>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Event Images</label>
      <EventImageUpload
        @files-changed="onFilesChanged"
      />
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t">
      <UButton variant="ghost" color="brand4" :disabled="isSaving" @click="cancel">Cancel</UButton>
      <UButton color="brand4" :loading="isSaving" @click="saveEvent">
        {{ isSaving ? 'Creating...' : 'Create Event' }}
      </UButton>
    </div>
  </div>
</template>