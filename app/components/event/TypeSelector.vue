<script setup lang="ts">
import { EVENT_TYPE_OPTIONS, type EventType } from '#shared/utils/eventType'

/**
 * The exclusive audience choice for an event. An event is exactly one of
 * these — volunteers and attendees, volunteers only, attendees only, or a
 * volunteer training session.
 */
withDefaults(defineProps<{
  color?: string
  label?: string
}>(), {
  color: 'primary',
  label: 'Who is this event for?',
})

const model = defineModel<EventType>({ default: 'VOLUNTEERS_AND_ATTENDEES' })
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
      {{ label }}
    </label>
    <URadioGroup
      v-model="model"
      :items="EVENT_TYPE_OPTIONS"
      :color="color"
      variant="card"
      indicator="start"
      :ui="{ item: 'w-full' }"
    >
      <template #label="{ item }">
        <span class="flex items-center gap-2">
          <UIcon
            :name="item.icon"
            class="w-4 h-4 shrink-0"
          />
          {{ item.label }}
        </span>
      </template>
    </URadioGroup>
  </div>
</template>
