<script setup>
import { ref, watch } from "vue"

const props = defineProps({
  event: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(["save", "delete"])

const editedEvent = ref({
  name: "",
  date: "",
  location: "",
  image: ""
})

// Watch for changes to the event prop and update the form
watch(() => props.event, (newEvent) => {
  if (newEvent) {
    editedEvent.value = { ...newEvent }
  }
}, { immediate: true })

function saveEvent() {
  emit("save", { ...editedEvent.value })
}

function deleteEvent() {
  emit("delete", editedEvent.value.id)
}
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-xl font-semibold">Edit Event</h3>

    <UFormGroup label="Event Name">
      <UInput v-model="editedEvent.name" />
    </UFormGroup>

    <UFormGroup label="Date">
      <UInput v-model="editedEvent.date" type="date" />
    </UFormGroup>

    <UFormGroup label="Location">
      <UInput v-model="editedEvent.location" />
    </UFormGroup>

    <UFormGroup label="Image URL">
      <UInput v-model="editedEvent.image" />
    </UFormGroup>

    <!-- Preview image if URL provided -->
    <div v-if="editedEvent.image" class="mt-2">
      <p class="text-sm text-gray-600 mb-2">Image Preview:</p>
      <img 
        :src="editedEvent.image" 
        alt="Event preview" 
        class="w-full h-32 object-cover rounded-lg"
        @error="$event.target.style.display = 'none'"
      >
    </div>

    <div class="flex justify-between pt-2">
      <UButton color="red" variant="soft" @click="deleteEvent">Delete Event</UButton>
      <UButton color="primary" @click="saveEvent">Save Changes</UButton>
    </div>
  </div>
</template>