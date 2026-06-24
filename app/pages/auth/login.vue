<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  requestOtpFields,
  requestOtpSchema,
  type RequestOtpSchema,
  verifyOtpFields,
  verifyOtpSchema,
  type VerifyOtpSchema,
} from '~/types/auth/login.type'

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const step = ref<'request' | 'verify'>('request')
const pendingEmail = ref<string>('')

async function onRequestOtp(event: FormSubmitEvent<RequestOtpSchema>) {
  isLoading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: event.data.email },
    })
    pendingEmail.value = event.data.email
    step.value = 'verify'
  }
  catch (error: unknown) {
    errorMessage.value = (error as { message: string }).message
  }
  finally {
    isLoading.value = false
  }
}

async function onVerifyOtp(event: FormSubmitEvent<VerifyOtpSchema>) {
  isLoading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/auth/verify-otp', {
      method: 'POST',
      body: {
        email: pendingEmail.value,
        otp: event.data.otp,
      },
    })
    await nextTick()
    await navigateTo('/')
  }
  catch (error: unknown) {
    errorMessage.value = (error as { message: string }).message
  }
  finally {
    isLoading.value = false
  }
}

function goBack() {
  step.value = 'request'
  errorMessage.value = null
}
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 min-h-screen">
    <UAuthForm
      v-if="step === 'request'"
      class="w-full max-w-md"
      :schema="requestOtpSchema"
      :fields="requestOtpFields"
      title="Welcome back!"
      icon="i-lucide-mail"
      :submit="{ label: 'Send code', block: true, color: 'neutral' }"
      @submit="onRequestOtp"
    >
      <template #description>
        Don't have an account?
        <ULink
          to="/auth/sign-up"
          class="text-primary font-medium"
        >
          Sign up
        </ULink>.
      </template>
      <template #validation>
        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-info"
          :title="errorMessage"
        />
      </template>
      <template #footer>
        By signing in, you agree to our
        <ULink
          to="#"
          class="text-primary font-medium"
        >
          Terms of Service
        </ULink>.
      </template>
    </UAuthForm>

    <UAuthForm
      v-else
      class="w-full max-w-md"
      :schema="verifyOtpSchema"
      :fields="verifyOtpFields"
      title="Check your email"
      icon="i-lucide-shield-check"
      :submit="{ label: 'Verify code', block: true, color: 'neutral' }"
      @submit="onVerifyOtp"
    >
      <template #description>
        We sent a 6-digit code to <strong>{{ pendingEmail }}</strong>.
        <ULink
          class="text-primary font-medium cursor-pointer"
          @click="goBack"
        >
          Wrong email?
        </ULink>
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
