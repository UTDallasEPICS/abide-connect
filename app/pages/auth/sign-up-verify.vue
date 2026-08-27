<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { verifyOtpFields, verifyOtpSchema, type VerifyOtpSchema } from '~/types/auth/login.type'
import { errorMessage as toErrorMessage } from '~/lib/errorMessage'
import { safeRedirect } from '~/lib/safeRedirect'

/**
 * Step two of sign-up: verify the emailed code and create the account.
 *
 * Reads the details /auth/sign-up parked in `sessionStorage` and posts them
 * with the code to `/api/auth/sign-up-verify`, which creates the user and
 * returns a live session. Landing here without those details (direct link, new
 * tab, reopened browser) means there's nothing to submit, so `onMounted`
 * redirects back to the start of the flow.
 *
 * `pendingSignUpRedirect` is stored under its own key rather than inside
 * `pendingSignUp`, because that object is spread wholesale into the request
 * body — a `redirect` field living in it would be posted to the API. It sends
 * the new account back to whatever they were trying to do (attend an event,
 * say) instead of the volunteer dashboard.
 */

definePageMeta({
  layout: 'secondary',
  backTo: '/auth/sign-up',
})

const errorMessage = ref<string | null>(null)
const isLoading = ref(false)
const pendingSignUp = ref<Record<string, unknown> | null>(null)
const redirectTo = ref('/volunteer/')

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
    }
    else {
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
  redirectTo.value = safeRedirect(sessionStorage.getItem('pendingSignUpRedirect'), '/volunteer/')
  startCooldown()
})

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function resendOtp() {
  if (!pendingSignUp.value?.email || resendCooldown.value > 0 || isResending.value) return
  isResending.value = true
  resendError.value = null
  try {
    await $fetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: pendingSignUp.value.email },
    })
    startCooldown()
  }
  catch (err: unknown) {
    resendError.value = toErrorMessage(err)
  }
  finally {
    isResending.value = false
  }
}

async function onVerify(event: FormSubmitEvent<VerifyOtpSchema>) {
  if (!pendingSignUp.value || isLoading.value) return
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
    sessionStorage.removeItem('pendingSignUpRedirect')
    await nextTick()
    await navigateTo(redirectTo.value)
  }
  catch (error: unknown) {
    console.log(error)
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <UAuthForm
      class="w-full"
      :schema="verifyOtpSchema"
      :fields="verifyOtpFields"
      title="Check your email"
      icon="i-lucide-shield-check"
      :submit="{ label: 'Verify & create account', block: true, color: 'neutral', loading: isLoading, disabled: isLoading }"
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
            <span
              v-if="resendCooldown > 0"
              class="text-muted"
            >Resend code in {{ resendCooldown }}s</span>
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
  </PageContainer>
</template>
