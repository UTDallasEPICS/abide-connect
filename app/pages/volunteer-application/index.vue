<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { volunteerApplicationStepSchemas, volunteerApplicationSteps, type VolunterApplicationSchema } from '~/types/volunteer/volunteer-application.type'

definePageMeta({
  layout: 'secondary',
  backTo: '/volunteer',
})

/**
 * Multi-step volunteer application form.
 *
 * Each step validates against its own slice of the schema
 * (`volunteerApplicationStepSchemas`), so users only see errors for fields
 * they've reached. Answers accumulate in `stepData` keyed by step index and are
 * merged into one payload on the final submit — nothing is sent until then, so
 * abandoning the form leaves no partial record.
 *
 * That also means a refresh loses everything: `stepData` is component state,
 * not persisted.
 *
 * Submitting creates the `Volunteer` record as PENDING and grants the VOLUNTEER
 * role. It does not grant access to volunteer events — approval happens after
 * attending a training session.
 */

const stepDescriptions = [
  'Thank you for your interest in volunteering with Abide Women\'s Health Services! Please fill out the form below to apply and register for our upcoming volunteer training.',
  'Please provide your emergency contact information. This is important for your safety and well-being while volunteering with us.',
  'Eligibility and Acknowledgements.',
]

const currentStepIndex = ref(0)
const isFirstStep = computed(() => currentStepIndex.value === 0)
const isLastStep = computed(() => currentStepIndex.value === volunteerApplicationSteps.length - 1)

// Data collected per step, same index as the two arrays above.
const stepData = ref<Record<number, Record<string, unknown>>>({})
const errorMessage = ref<string | null>(null)
const isLoading = ref(false)

async function onSubmit(payload: FormSubmitEvent<Record<string, unknown>>) {
  stepData.value[currentStepIndex.value] = payload.data

  if (!isLastStep.value) {
    currentStepIndex.value++
    return
  }

  const fullApplication = Object.values(stepData.value).reduce(
    (acc, data) => ({ ...acc, ...data }),
    {},
  ) as VolunterApplicationSchema

  isLoading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/volunteer/application', {
      method: 'POST',
      body: fullApplication,
    })
    await navigateTo('/volunteer-application/completed', { replace: true })
  }
  catch {
    errorMessage.value = 'Something went wrong submitting your application. Please try again.'
  }
  finally {
    isLoading.value = false
  }
}

function goToPreviousStep() {
  if (currentStepIndex.value > 0) currentStepIndex.value--
}
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <UAuthForm
      class="w-full"
      :fields="volunteerApplicationSteps[currentStepIndex]"
      :schema="volunteerApplicationStepSchemas[currentStepIndex]"
      :loading="isLoading && isLastStep"
      icon="material-symbols:volunteer-activism-outline"
      title="Volunteer Application"
      @submit="onSubmit"
      @error="console.log(`Step ${currentStepIndex + 1} form error:`, $event)"
    >
      <template #description>
        <p class="font-normal text-sm text-muted">
          {{ stepDescriptions[currentStepIndex] }}
        </p>
        <p class="mt-2 text-sm text-muted">
          Step {{ currentStepIndex + 1 }} of {{ volunteerApplicationSteps.length }}
        </p>
      </template>

      <template #codeOfConductNdaAcknowledgement-description>
        I acknowledge that I have read, understand, and agree to abide by and comply with the terms of the
        <a
          href="https://drive.google.com/file/d/13p7OBlJl7BNxoKseP9-83i6S7m55-YBO/view?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          class="underline text-primary"
        >Code of Conduct</a>
        and the
        <a
          href="https://drive.google.com/file/d/1dKLmm6qOAR751_duccfkMfIBvcChcFWl/view?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          class="underline text-primary"
        >Confidentiality/Non-Disclosure Agreement (NDA)</a>.
      </template>
      <template #volunteerHandbookAcknowledgement-description>
        I acknowledge that I have read, understand, and agree to abide by and comply with the terms of the
        <a
          href="https://drive.google.com/file/d/1W3Vom6kw8vuOuiOBjWtakHZC6Q0yRtCx/view?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          class="underline text-primary"
        >Volunteer Handbook</a>.
      </template>

      <template #submit>
        <div class="grid grid-cols-2 gap-3 w-full">
          <UButton
            type="button"
            label="Back"
            icon="i-lucide-arrow-left"
            variant="soft"
            color="neutral"
            size="lg"
            block
            :ui="{ base: 'justify-center' }"
            :disabled="isFirstStep || isLoading"
            @click="goToPreviousStep"
          />
          <UButton
            type="submit"
            color="neutral"
            size="lg"
            block
            :ui="{ base: 'justify-center gap-2' }"
            :loading="isLoading && isLastStep"
          >
            {{ isLastStep ? 'Submit' : 'Next' }}
            <UIcon
              v-if="!isLastStep"
              name="i-lucide-arrow-right"
            />
          </UButton>
          <br>
        </div>
      </template>

      <template #validation>
        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-info"
          :title="errorMessage"
        />
      </template>
    </UAuthForm>
  </PageContainer>
</template>
