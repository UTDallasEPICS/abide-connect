<script setup lang="ts">
/**
 * Email-OTP login, native.
 *
 * Two-step form on one route: request a code, then enter it. Same endpoints and
 * same landing logic as the web page (`app/lib/landingRoute.ts`), but the form
 * is hand-built from `NInput`/`NButton` because the web's `UAuthForm` +
 * `@nuxt/ui` field schemas don't exist natively.
 *
 * `?redirect=` arrives as a **prop**, not a query: `useNativeNavigate` pushes
 * routes with `$navigateTo(component, { props })`, so a caller passes
 * `{ params: { redirect: '/events/42' } }` and this component receives it.
 *
 * Only for existing accounts — the OTP plugin runs with `disableSignUp: true`,
 * so requesting a code for an unknown address fails rather than registering.
 */
import { computed, onUnmounted, ref } from 'vue'
import SecondaryLayout from '~/layouts/secondary.vue'
import { apiFetch } from '~/lib/api'
import { errorMessage as toErrorMessage } from '~/lib/errorMessage'
import { resolveLandingRoute } from '~/lib/landingRoute'
import { useSession } from '~/composables/useSession'
import { useUserRoles } from '~/composables/useUserRoles'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
import { colors, fontSizes, spacing } from 'nuxt-native/runtime/theme.js'

const props = defineProps<{ redirect?: string }>()

const router = useNativeNavigate()

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const step = ref<'request' | 'verify'>('request')
const email = ref('')
const otp = ref('')
const pendingEmail = ref('')

const resendCooldown = ref(0)
const isResending = ref(false)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const resendLabel = computed(() => (
  resendCooldown.value > 0 ? `Resend in ${resendCooldown.value}s` : 'Resend code'
))

function startCooldown(): void {
  resendCooldown.value = 30
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    if (resendCooldown.value > 0) resendCooldown.value--
    else if (cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

function validateEmail(value: string): boolean {
  return /.+@.+\..+/.test(value.trim())
}

async function onRequestOtp(): Promise<void> {
  if (isLoading.value) return
  errorMessage.value = null

  if (!validateEmail(email.value)) {
    errorMessage.value = 'Enter a valid email address.'
    return
  }

  isLoading.value = true
  try {
    await apiFetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: email.value.trim() },
    })
    pendingEmail.value = email.value.trim()
    otp.value = ''
    step.value = 'verify'
    startCooldown()
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isLoading.value = false
  }
}

async function onVerifyOtp(): Promise<void> {
  if (isLoading.value) return
  errorMessage.value = null

  if (!/^\d{6}$/.test(otp.value)) {
    errorMessage.value = 'Enter the 6-digit code.'
    return
  }

  isLoading.value = true
  try {
    // `roles` comes back with the session so the landing page can be picked
    // without a second request racing the cookie this response is setting.
    const { roles } = await apiFetch<{ roles: string[] }>('/api/auth/verify-otp', {
      method: 'POST',
      body: { email: pendingEmail.value, otp: otp.value },
    })

    // Let the shared composables pick up the new cookie/roles for the shell.
    await useSession().refresh(true)
    await useUserRoles().refresh(true)

    const landing = await resolveLandingRoute(props.redirect, roles)
    const target = router.exists(landing) ? landing : 'index'
    await router.to(target, { clearHistory: true })
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isLoading.value = false
  }
}

async function resendOtp(): Promise<void> {
  if (!pendingEmail.value || resendCooldown.value > 0 || isResending.value) return
  isResending.value = true
  errorMessage.value = null
  try {
    await apiFetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: pendingEmail.value },
    })
    startCooldown()
  }
  catch (error) {
    errorMessage.value = toErrorMessage(error)
  }
  finally {
    isResending.value = false
  }
}

function goBack(): void {
  step.value = 'request'
  errorMessage.value = null
  otp.value = ''
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = null
  resendCooldown.value = 0
}
</script>

<template>
  <SecondaryLayout title="Sign in">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText
        variant="h2"
        :text="step === 'request' ? 'Welcome back!' : 'Check your email'"
        :style="{ marginBottom: spacing.sm }"
      />
      <NText
        variant="body"
        :text="step === 'request'
          ? 'Sign in with a one-time code sent to your email.'
          : `We sent a 6-digit code to ${pendingEmail}.`"
        :style="{ marginBottom: spacing.xl, color: colors.textMuted, fontSize: fontSizes.md }"
      />

      <NCard>
        <StackLayout v-if="step === 'request'">
          <NInput
            v-model="email"
            label="Email"
            placeholder="you@example.com"
          />
          <NButton
            text="Send code"
            :loading="isLoading"
            :disabled="isLoading"
            :style="{ marginTop: spacing.lg }"
            @tap="onRequestOtp"
          />
        </StackLayout>

        <StackLayout v-else>
          <NInput
            v-model="otp"
            label="Verification code"
            placeholder="123456"
            :max-length="6"
          />
          <NButton
            text="Verify"
            :loading="isLoading"
            :disabled="isLoading"
            :style="{ marginTop: spacing.lg }"
            @tap="onVerifyOtp"
          />
          <GridLayout
            columns="*, auto"
            :style="{ marginTop: spacing.md }"
          >
            <NButton
              col="0"
              text="Use a different email"
              variant="ghost"
              size="sm"
              :disabled="isResending"
              @tap="goBack"
            />
            <NButton
              col="1"
              :text="resendLabel"
              variant="ghost"
              size="sm"
              :disabled="resendCooldown > 0 || isResending"
              @tap="resendOtp"
            />
          </GridLayout>
        </StackLayout>

        <NText
          v-if="errorMessage"
          variant="caption"
          :color="colors.danger"
          :text="errorMessage"
          :style="{ marginTop: spacing.md }"
        />
      </NCard>
    </StackLayout>
  </SecondaryLayout>
</template>
