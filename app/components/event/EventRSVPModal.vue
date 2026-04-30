<script setup lang="ts">
const props = defineProps<{
  eventId: string
  isVolunteer: boolean
}>()

const emit = defineEmits(['success', 'close'])

const name = ref('')
const email = ref('')
const isSubmitting = ref(false)
const error = ref('')

async function submit() {
  if (!name.value.trim() || !email.value.trim()) {
    error.value = 'Please fill in all fields'
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    // @ts-ignore
    await $fetch(`/api/events/${props.eventId}/rsvp`, {
      method: 'POST',
      body: {
        name: name.value,
        email: email.value,
        isVolunteer: props.isVolunteer,
      }
    })
    emit('success')
  } catch (err: any) {
    error.value = err?.data?.message || 'Something went wrong. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <h3 class="text-xl font-semibold text-brand4">
      {{ isVolunteer ? 'Sign Up as Volunteer' : 'Register to Attend' }}
    </h3>

    <p class="text-sm text-gray-500">
      {{ isVolunteer
        ? 'Fill in your details to volunteer at this event.'
        : 'Fill in your details to register as an attendee.' }}
    </p>

    <UFormField label="Full Name">
      <UInput v-model="name" placeholder="Your name" />
    </UFormField>

    <UFormField label="Email">
      <UInput v-model="email" type="email" placeholder="your@email.com" />
    </UFormField>

    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

    <div class="flex justify-end gap-2 pt-2 border-t">
      <UButton variant="ghost" color="brand4" :disabled="isSubmitting" @click="$emit('close')">
        Cancel
      </UButton>
      <UButton color="brand4" :loading="isSubmitting" @click="submit">
        {{ isVolunteer ? 'Sign Up' : 'Register' }}
      </UButton>
    </div>
  </div>
</template>