<script setup>
import { ref, watch } from 'vue'

const emit = defineEmits(['save', 'close'])

const newEvent = ref({
  title: '',
  shortDesc: '',
  description: '',
  location: '',
  startTime: '',
  endTime: '',
  allowVolunteers: false,
  allowAttendees: false,
  mobileClinicId: null,
  eventAssets: [],
})

const isSaving = ref(false)

// Store actual File objects for upload
const filesToUpload = ref([])

watch(filesToUpload, async (newFiles) => {
  if (!newFiles || newFiles.length === 0) {
    newEvent.value.eventAssets = []
    return
  }
  const previews = await Promise.all(
    Array.from(newFiles).map(file => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = e => resolve({ imageUrl: e.target.result, fileName: file.name })
      reader.readAsDataURL(file)
    })),
  )
  newEvent.value.eventAssets = previews
})

async function saveEvent() {
  // Validate required fields
  if (!newEvent.value.title || !newEvent.value.startTime || !newEvent.value.endTime) {
    alert('Please fill in all required fields (Title, Start Time, End Time)')
    return
  }

  isSaving.value = true

  try {
    // Step 1: Create the event in the database
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
        mobileClinicId: newEvent.value.mobileClinicId,
      },
    })

    console.log('✅ Event created:', response)

    // Step 2: Upload images if event was created successfully
    if (response.id && filesToUpload.value.length > 0) {
      console.log(`📤 Uploading ${filesToUpload.value.length} images...`)

      for (const file of filesToUpload.value) {
        const formData = new FormData()
        formData.append('file', file)

        try {
          await $fetch(`/api/events/${response.id}/images/upload`, {
            method: 'POST',
            body: formData,
          })
          console.log(`✅ Uploaded: ${file.name}`)
        }
        catch (uploadError) {
          console.error(`❌ Failed to upload ${file.name}:`, uploadError)
        }
      }
    }

    // Step 3: Fetch the complete event with images from the server
    const completeEvent = await $fetch(`/api/events/${response.id}`)

    console.log('✅ Complete event fetched:', completeEvent)

    // Step 4: Emit the complete event to parent
    emit('save', completeEvent)

    // Step 5: Reset form
    newEvent.value = {
      title: '',
      shortDesc: '',
      description: '',
      location: '',
      startTime: '',
      endTime: '',
      allowVolunteers: false,
      allowAttendees: false,
      mobileClinicId: null,
      eventAssets: [],
    }
    filesToUpload.value = []

    console.log('✅ Event saved successfully and form reset')
  }
  catch (error) {
    console.error('❌ Error creating event:', error)
    alert(`Error creating event: ${error.message || 'Please try again.'}`)
  }
  finally {
    isSaving.value = false
  }
}

function cancel() {
  emit('close')
}
</script>

<template>
  <div class="space-y-4 p-6 max-h-[80vh] overflow-y-auto">
    <h3 class="text-xl font-semibold mb-4">
      Add New Event
    </h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Event Title <span class="text-red-500">*</span>
      </label>
      <UFormField>
        <UInput
          v-model="newEvent.title"
          placeholder="Enter event title"
        />
      </UFormField>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
      <UFormField>
        <UInput
          v-model="newEvent.shortDesc"
          placeholder="Brief description"
        />
      </UFormField>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
      <UFormField>
        <UTextarea
          v-model="newEvent.description"
          placeholder="Detailed description"
          :rows="4"
        />
      </UFormField>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
      <UFormField>
        <UInput
          v-model="newEvent.location"
          placeholder="Enter location address"
        />
      </UFormField>
    </div>

    <div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Start Date & Time <span class="text-red-500">*</span>
        </label>
        <UFormField>
          <UInput
            v-model="newEvent.startTime"
            type="datetime-local"
          />
        </UFormField>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          End Date & Time <span class="text-red-500">*</span>
        </label>
        <UFormField>
          <UInput
            v-model="newEvent.endTime"
            type="datetime-local"
          />
        </UFormField>
      </div>
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
      <UFormField label="Event Images">
        <UFileUpload
          v-model="filesToUpload"
          multiple
          accept="image/*"
          placeholder="Upload images"
        />
      </UFormField>
    </div>

    <div class="flex justify-end gap-2 pt-4 border-t">
      <UButton
        variant="ghost"
        color="brand4"
        :disabled="isSaving"
        @click="cancel"
      >
        Cancel
      </UButton>
      <UButton
        color="brand4"
        :loading="isSaving"
        @click="saveEvent"
      >
        {{ isSaving ? 'Creating...' : 'Create Event' }}
      </UButton>
    </div>
  </div>
</template>
