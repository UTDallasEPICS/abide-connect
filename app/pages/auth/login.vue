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
import { errorMessage as toErrorMessage } from '~/lib/errorMessage'
import { safeRedirect } from '~/lib/safeRedirect'

/**
 * Email-OTP login, as a two-step form on one route: request a code, then enter
 * it. `step` drives which schema and fields render.
 *
 * Only for existing accounts — the OTP plugin runs with `disableSignUp: true`,
 * so requesting a code for an unknown address fails rather than registering.
 * New users go through /auth/sign-up.
 *
 * A `?redirect=` query param survives the whole flow, including the hop to
 * sign-up: pages that turn a signed-out visitor away (an event's "Sign in to
 * register", say) set it so the user lands back where they were instead of on
 * the home page. It's run through `safeRedirect`, so an off-site value is
 * discarded rather than followed.
 *
 * The 30s resend cooldown is client-side only — it keeps the button from being
 * hammered, but `/api/auth/request-otp` has no throttle of its own, so it isn't
 * enforcement.
 */

definePageMeta({
  layout: 'secondary',
  backTo: '/',
})

const route = useRoute()
const redirectTo = computed(() => safeRedirect(route.query.redirect))
const signUpLink = computed(() => ({
  path: '/auth/sign-up',
  query: route.query.redirect ? { redirect: route.query.redirect } : undefined,
}))

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const step = ref<'request' | 'verify'>('request')
const pendingEmail = ref<string>('')

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

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

async function onRequestOtp(event: FormSubmitEvent<RequestOtpSchema>) {
  if (isLoading.value) return
  isLoading.value = true
  errorMessage.value = null

  try {
    await $fetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: event.data.email },
    })
    pendingEmail.value = event.data.email
    step.value = 'verify'
    startCooldown()
  }
  catch (error: unknown) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isLoading.value = false
  }
}

async function onVerifyOtp(event: FormSubmitEvent<VerifyOtpSchema>) {
  if (isLoading.value) return
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
    await navigateTo(redirectTo.value)
  }
  catch (error: unknown) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isLoading.value = false
  }
}

async function resendOtp() {
  if (!pendingEmail.value || resendCooldown.value > 0 || isResending.value) return
  isResending.value = true
  resendError.value = null
  try {
    await $fetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: pendingEmail.value },
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

function goBack() {
  step.value = 'request'
  errorMessage.value = null
  if (cooldownTimer) clearInterval(cooldownTimer)
  resendCooldown.value = 0
}
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <UAuthForm
      v-if="step === 'request'"
      class="w-full"
      :schema="requestOtpSchema"
      :fields="requestOtpFields"
      title="Welcome back!"
      icon="i-lucide-mail"
      :submit="{ label: 'Send code', block: true, color: 'neutral', loading: isLoading, disabled: isLoading }"
      @submit="onRequestOtp"
    >
      <template #description>
        Don't have an account?
        <ULink
          :to="signUpLink"
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
        <div class="mt-4 text-center">
          <ULink
            to="/auth/staff-login"
            class="text-muted font-medium text-sm"
          >
            Staff Login
          </ULink>
        </div>
      </template>
    </UAuthForm>

    <UAuthForm
      v-else
      class="w-full max-w-md"
      :schema="verifyOtpSchema"
      :fields="verifyOtpFields"
      title="Check your email"
      icon="i-lucide-shield-check"
      :submit="{ label: 'Verify code', block: true, color: 'neutral', loading: isLoading, disabled: isLoading }"
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
        </div>
      </template>
    </UAuthForm>
  </PageContainer>
</template>
