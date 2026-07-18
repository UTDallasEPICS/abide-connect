<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { verifyOtpFields, verifyOtpSchema, type VerifyOtpSchema } from '~/types/auth/login.type'

const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const pendingSignUp = ref<Record<string, unknown> | null>(null)

const resendCooldown = ref(0)
const isResending = ref(false)
const resendError = ref<string | null>(null)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldown() {
  resendCooldown.value = 30
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    if (resendCooldown.value > 0) {
      resendCooldown.value--
    } else {
      clearInterval(cooldownTimer!)
      cooldownTimer = null
    }
  }, 1000)
}

onMounted(() => {
  const stored = sessionStorage.getItem('pendingSignUp')
  if (!stored) {
    navigateTo('/auth/sign-up')
    return
  }
  pendingSignUp.value = JSON.parse(stored)
  startCooldown()
})

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function resendOtp() {
  if (!pendingSignUp.value?.email || resendCooldown.value > 0) return
  isResending.value = true
  resendError.value = null
  try {
    await $fetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: pendingSignUp.value.email },
    })
    startCooldown()
  } catch (err: unknown) {
    resendError.value = (err as { message: string }).message
  } finally {
    isResending.value = false
  }
}

async function onVerify(event: FormSubmitEvent<VerifyOtpSchema>) {
  if (!pendingSignUp.value) return
  isLoading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/auth/sign-up-verify', {
      method: 'POST',
      body: {
        otp: event.data.otp,
        ...pendingSignUp.value,
      },
    })
    sessionStorage.removeItem('pendingSignUp')
    await nextTick()
    await navigateTo('/volunteer/')
  }
  catch (error: unknown) {
    console.log(error)
    errorMessage.value = (error as { message: string }).message
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 min-h-screen">
    <UAuthForm
      class="w-full max-w-md"
      :schema="verifyOtpSchema"
      :fields="verifyOtpFields"
      title="Check your email"
      icon="i-lucide-shield-check"
      :submit="{ label: 'Verify & create account', block: true, color: 'neutral' }"
      @submit="onVerify"
    >
      <template #description>
        We sent a 6-digit code to <strong>{{ (pendingSignUp as any)?.email }}</strong>.
        <ULink
          to="/auth/sign-up"
          class="text-primary font-medium"
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
      <template #footer>
        <div class="flex flex-col items-center gap-2 w-full">
          <div class="text-sm">
            <span v-if="resendCooldown > 0" class="text-muted">Resend code in {{ resendCooldown }}s</span>
            <UButton
              v-else
              variant="link"
              size="sm"
              :loading="isResending"
              class="p-0"
              @click="resendOtp"
            >
              Resend code
            </UButton>
          </div>
          <UAlert
            v-if="resendError"
            color="error"
            icon="i-lucide-info"
            :title="resendError"
            class="w-full"
          />
          <span>By signing up, you agree to our <ULink
            to="#"
            class="text-primary font-medium"
          >Terms of Service</ULink>.</span>
        </div>
      </template>
    </UAuthForm>
  </div>
</template>
