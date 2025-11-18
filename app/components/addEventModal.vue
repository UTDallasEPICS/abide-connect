<script setup>
import { ref } from "vue"

const emit = defineEmits(["save"])

const newEvent = ref({
  name: "",
  date: "",
  location: "",
  image: ""
})

function saveEvent() {
  emit("save", { ...newEvent.value })
}
</script>

<template>
  <div class="space-y-4 p-4">
    <h3 class="text-xl font-semibold mb-4">Add New Event</h3>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Event Name</label>
      <UFormGroup>
        <UInput v-model="newEvent.name" placeholder="Enter event name" />
      </UFormGroup>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
      <UFormGroup>
        <UInput type="date" v-model="newEvent.date" />
      </UFormGroup>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
      <UFormGroup>
        <UInput v-model="newEvent.location" placeholder="Enter location" />
      </UFormGroup>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
      <UFormGroup>
        <UInput v-model="newEvent.image" placeholder="https://example.com/image.jpg" />
      </UFormGroup>
    </div>

    <div class="flex justify-end pt-2">
      <UButton color="primary" @click="saveEvent">Save Event</UButton>
    </div>

  </div>
</template>