<script setup lang="ts">
import { ref } from "vue"
import { applicationFields, applicationSchema } from "~/types/auth/application.type"
import { signUpFields, signUpSchema } from "~/types/auth/sign-up.type"
import { authProviders } from "~/types/auth/providers.type"

const step = ref(1)
const form = ref<any>({})
const errorMessage = ref<string | null>(null)

/* STEP 1 */
function handleStep1(payload: any) {
  form.value = { ...payload.data }
  step.value = 2
}

/* FINAL SUBMIT */
async function submitAll(payload: any) {
  try {
    const finalData = {
      ...form.value,
      ...payload.data,

      // 🔥 convert YES/NO → boolean (important)
      over18: payload.data?.over18 === "YES",

      hasVolunteered: payload.data?.hasVolunteered === "YES",
      attendedTraining: payload.data?.attendedTraining === "YES",
    }

    await $fetch("/api/volunteer/application", {
      method: "POST",
      body: finalData,
    })

    await navigateTo("/auth/thank-you")

  } catch (err) {
    console.error(err)
    errorMessage.value = "Submission failed"
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 my-8">

    <!-- STEP 1 -->
    <UAuthForm
      v-if="step === 1"
      class="w-full max-w-md"
      :schema="signUpSchema"
      :fields="signUpFields"
      :providers="authProviders"
      title="Let's get you started"
      :submit="{ label: 'Next', block: true }"
      @submit="handleStep1"
    />

    <!-- STEP 2 -->
    <div v-if="step === 2" class="w-full max-w-2xl pb-32">

      <button
        class="text-sm text-primary mb-4"
        @click="step = 1"
      >
        ← Back
      </button>

      <UAuthForm
        :schema="applicationSchema"
        :fields="applicationFields"
        title="Volunteer Application"
        :submit="{ label: 'Submit Application', block: true }"
        @submit="submitAll"
      />

      <p v-if="errorMessage" class="text-red-400 mt-4">
        {{ errorMessage }}
      </p>

    </div>
  </div>
</template>

<style scoped>
.section {
  background: #111c33;
  padding: 20px;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

h3 {
  font-weight: bold;
  margin-bottom: 10px;
}

input, select, textarea {
  padding: 10px;
  border-radius: 6px;
  background: #0b1324;
  color: white;
}

.checkbox {
  display: flex;
  gap: 10px;
  align-items: center;
}

.submit-btn {
  background: #4ade80;
  padding: 12px;
  border-radius: 8px;
  width: 100%;
  font-weight: bold;
}
</style>