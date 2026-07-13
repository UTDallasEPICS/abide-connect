<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { volunteerApplicationStepSchemas, volunteerApplicationSteps, type VolunterApplicationSchema } from '~/types/volunteer/volunteer-application.type';

const stepDescriptions = [
  'Thank you for your interest in volunteering with Abide Women\'s Health Services! Please fill out the form below to apply and register for our upcoming volunteer training.',
  'Eligibility and Acknowledgements.',
]

const currentStepIndex = ref(0)
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
    // TODO: send fullApplication to your API endpoint
    console.log(fullApplication)
  } catch {
    errorMessage.value = 'Something went wrong submitting your application. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function goToPreviousStep() {
  if (currentStepIndex.value > 0) currentStepIndex.value--
}
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 my-8">
    <UAuthForm
      class="w-full max-w-md mb-16"
      :fields="volunteerApplicationSteps[currentStepIndex]"
      :schema="volunteerApplicationStepSchemas[currentStepIndex]"
      :loading="isLoading && isLastStep"
      icon="material-symbols:volunteer-activism-outline"
      title="Volunteer Application"
      :submit="{ label: isLastStep ? 'Submit' : 'Continue', block: true, color: 'neutral' }"
      @submit="onSubmit"
      @error="console.log(`Step ${currentStepIndex + 1} form error:`, $event)"
    >
      <template #description>
        <p class="font-normal">
          {{ stepDescriptions[currentStepIndex] }}
        </p>
        <p class="my-2 text-sm text-muted">
          Step {{ currentStepIndex + 1 }} of {{ volunteerApplicationSteps.length }}
        </p>
        <UButton
          v-if="currentStepIndex > 0"
          label="Go back"
          icon="i-lucide-arrow-left"
          variant="link"
          color="neutral"
          class="p-0 mb-2"
          @click="goToPreviousStep"
        />
      </template>

      <template #missionValuesAcknowledgement-label>
        I have read
        <a href="https://www.abidewomen.org/about" target="_blank" rel="noopener noreferrer" class="underline text-primary">Abide's mission, vision, and values</a>
        and understand that Abide is led and run by BIPOC and will always be centered around BIPOC.
      </template>
      <template #codeOfConductNdaAcknowledgement-description>
        I acknowledge that I have read, understand, and agree to abide by and comply with the terms of the
        <a href="https://drive.google.com/file/d/13p7OBlJl7BNxoKseP9-83i6S7m55-YBO/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="underline text-primary">Code of Conduct</a>
        and the
        <a href="https://drive.google.com/file/d/1dKLmm6qOAR751_duccfkMfIBvcChcFWl/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="underline text-primary">Confidentiality/Non-Disclosure Agreement (NDA)</a>.
      </template>
      <template #volunteerHandbookAcknowledgement-description>
        I acknowledge that I have read, understand, and agree to abide by and comply with the terms of the
        <a href="https://drive.google.com/file/d/1W3Vom6kw8vuOuiOBjWtakHZC6Q0yRtCx/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="underline text-primary">Volunteer Handbook</a>.
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
  </div>
</template>