<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SignUpSchema } from '~/types/auth/sign-up.type'
import { signUpFields, signUpSchema } from '~/types/auth/sign-up.type'
import { authProviders } from '~/types/auth/providers.type'

/**
 * Step one of sign-up: collect details and send a verification code.
 *
 * No account is created here. The entered details are parked in
 * `sessionStorage` under `pendingSignUp` and the user moves to
 * /auth/sign-up-verify, which submits them together with the code — the account
 * only exists once the email is proven.
 *
 * `sessionStorage` (not `localStorage`) so the half-finished sign-up dies with
 * the tab rather than lingering on a shared device. The trade-off is that
 * opening the emailed code in a *new* tab loses the pending details and bounces
 * the user back here.
 */

const errorMessage = ref<string | null>(null)

const isLoading = ref(false)

async function onSubmit(payload: FormSubmitEvent<SignUpSchema>) {
  isLoading.value = true
  errorMessage.value = null
  console.log(payload.data)
  try {
    await $fetch('/api/auth/request-otp', {
      method: 'POST',
      body: { email: payload.data.email },
    })
    sessionStorage.setItem('pendingSignUp', JSON.stringify({
      name: payload.data.name,
      email: payload.data.email,
      phone: payload.data.phone,
    }))
    await navigateTo('/auth/sign-up-verify')
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
  <div class="flex flex-col items-center justify-center p-8 my-8 ">
    <UAuthForm
      class="w-full max-w-md"
      :fields="signUpFields"
      :providers="authProviders"
      :schema="signUpSchema"
      title="Let's get you started to be a Volunteer!"
      icon="i-lucide-user"
      :separator="{
        icon: 'i-lucide-mail',
      }"
      :submit="{ label: 'Sign up', block: true, color: 'neutral' }"
      @submit="onSubmit"
      @error="console.log('Sign up form error:', $event)"
    >
      <template #description>
        Already have an account? <ULink
          to="/auth/login"
          class="text-primary font-medium"
        >Log In</ULink>.
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
        By signing in, you agree to our <ULink
          to="#"
          class="text-primary font-medium"
        >Terms of Service</ULink>.
      </template>
    </UAuthForm>
  </div>
</template>
