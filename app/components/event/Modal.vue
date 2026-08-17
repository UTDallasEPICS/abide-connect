<script setup lang="ts">
import { useColorMode } from '#imports'
import type { EventType } from '#shared/utils/eventType'
import { fromDateTimeLocal, validateTimeSlots } from '#shared/utils/timeSlot'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

/**
 * Create-event dialog. Unlike `Editor.vue` (which delegates writes to its
 * parent) this owns the whole flow itself.
 *
 * Creation is two sequential requests, because images can only be attached
 * once the event has an id: POST the event, then upload each file against the
 * returned id. A failure partway leaves the event created with some or none of
 * its images — there's no rollback.
 *
 * `emptyEvent()` is a factory rather than a shared constant so resetting the
 * form after a save can't hand back an object the previous submission mutated.
 */
const emit = defineEmits(['save', 'close'])

interface TimeSlotRow {
  id: string | null
  startTime: string
  endTime: string
  capacity: number
  role?: string | null
  note?: string | null
  color?: string | null
}

const emptyEvent = () => ({
  title: '',
  shortDesc: '',
  description: '',
  location: '',
  startTime: '',
  endTime: '',
  eventType: 'VOLUNTEERS_AND_ATTENDEES' as EventType,
  mobileClinicId: null,
  eventAssets: [],
  timeSlots: [] as TimeSlotRow[],
})

const newEvent = ref(emptyEvent())

// Blocks are volunteer shifts, so they only make sense where volunteers can
// sign up. An attendees-only or training event gets no editor and sends none.
const acceptsTimeBlocks = computed(() =>
  newEvent.value.eventType === 'VOLUNTEERS'
  || newEvent.value.eventType === 'VOLUNTEERS_AND_ATTENDEES',
)

const isSaving = ref(false)

// Store actual File objects for upload
const filesToUpload = ref([] as File[])

function onFilesChanged(files: File[]) {
  filesToUpload.value = files
}

async function saveEvent() {
  // Validate required fields
  if (
    !newEvent.value.title
    || !newEvent.value.location
    || !newEvent.value.startTime
    || !newEvent.value.endTime
  ) {
    alert('Please fill in all required fields (Title, Location, Start Time, End Time)')
    return
  }

  const timeSlots = acceptsTimeBlocks.value ? newEvent.value.timeSlots : []

  // The same rules the server enforces, run here only so the admin gets a
  // specific message instead of a round-trip. The server re-checks regardless.
  const slotProblems = validateTimeSlots(
    timeSlots.map(slot => ({
      id: slot.id,
      startTime: fromDateTimeLocal(slot.startTime),
      endTime: fromDateTimeLocal(slot.endTime),
      capacity: Number(slot.capacity),
      role: slot.role,
    })),
    {
      startTime: fromDateTimeLocal(newEvent.value.startTime),
      endTime: fromDateTimeLocal(newEvent.value.endTime),
    },
  )

  if (slotProblems.length > 0) {
    alert(slotProblems.join('\n'))
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
        eventType: newEvent.value.eventType,
        mobileClinicId: newEvent.value.mobileClinicId,
        // Created in the same transaction as the event itself.
        timeSlots: timeSlots.map(slot => ({
          startTime: fromDateTimeLocal(slot.startTime).toISOString(),
          endTime: fromDateTimeLocal(slot.endTime).toISOString(),
          capacity: Number(slot.capacity),
          role: slot.role ?? null,
          note: slot.note ?? null,
          color: slot.color ?? null,
        })),
      },
    })

    // Step 2: Upload images
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

    // Step 3: Fetch complete event with images
    const completeEvent = await $fetch(`/api/events/${response.id}`)

    console.log('✅ Complete event fetched:', completeEvent)

    // Step 4: Emit the complete event to parent
    emit('save', completeEvent)

    // Step 5: Reset form
    newEvent.value = emptyEvent()
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
    <h3 class="text-xl font-semibold mb-4 dark:text-gray-100">
      Add New Event
    </h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Short Description</label>
      <UFormField>
        <UInput
          v-model="newEvent.shortDesc"
          placeholder="Brief description"
        />
      </UFormField>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Full Description</label>
      <UFormField>
        <UTextarea
          v-model="newEvent.description"
          placeholder="Detailed description"
          :rows="4"
        />
      </UFormField>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
        Location <span class="text-red-500">*</span>
      </label>
      <UFormField>
        <UInput
          v-model="newEvent.location"
          placeholder="Enter location address"
        />
      </UFormField>
    </div>

    <div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
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
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          End Date & Time <span class="text-red-500">*</span>
        </label>
        <UFormField>
          <UInput
            v-model="newEvent.endTime"
            type="datetime-local"
          />
        </UFormField>
      </div>

      <EventTypeSelector
        v-model="newEvent.eventType"
        class="mt-4"
        :color="isDark ? 'brand8' : 'primary'"
      />

      <EventTimeSlotEditor
        v-if="acceptsTimeBlocks"
        v-model="newEvent.timeSlots"
        :event-start="newEvent.startTime"
        :event-end="newEvent.endTime"
        :color="isDark ? 'brand8' : 'primary'"
        seed-when-empty
        class="mt-4"
      />

      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Event Images</label>
        <EventImageUpload
          @files-changed="onFilesChanged"
        />
      </div>

      <div class="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="isSaving"
          @click="cancel"
        >
          Cancel
        </UButton>
        <UButton
          :color="isDark ? 'brand8' : 'primary'"
          :loading="isSaving"
          @click="saveEvent"
        >
          {{ isSaving ? "Creating..." : "Create Event" }}
        </UButton>
      </div>
    </div>
  </div>
</template>
