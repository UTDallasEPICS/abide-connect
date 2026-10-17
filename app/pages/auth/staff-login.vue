<script setup lang="ts">
import { Browser } from '@capacitor/browser'
import { authClient } from '#server/utils/auth-client'
import { forceAccountPicker } from '~/lib/googleSignIn'
import { beginNativeHandoff, isNativeApp } from '~/lib/nativeApp'

/**
 * Staff sign-in. Not really a page — `onMounted` fires the Google OAuth
 * redirect immediately, so it only renders while bouncing, or to show an error
 * if the handoff fails.
 *
 * Separate from /auth/login because staff need the Google flow specifically:
 * calendar sync writes to the shared Abide calendar using the acting user's
 * Google token, which an email-OTP session doesn't have.
 *
 * `disableRedirect: true` asks better-auth for the target URL rather than
 * navigating itself, so a failure surfaces as `error` here instead of a blank
 * redirect. It also gives us the authorize URL in hand, which is what lets
 * `forceAccountPicker` adjust it — better-auth's `signIn.social` takes
 * `scopes`/`loginHint` but has no `prompt` option to pass through.
 * `isLoading` starts true because the redirect begins on mount.
 *
 * In the native app Google won't sign anyone in inside the WebView, so the
 * flow is opened in the system browser instead and comes back through
 * `/auth/native/*` and the `native-app` plugin, which finishes the sign-in.
 * `?failed` is how that plugin reports a handoff that didn't take; it stops
 * this page from reopening the browser straight away on top of the error.
 */

definePageMeta({
  layout: 'secondary',
  backTo: '/auth/login',
})

const route = useRoute()
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

async function signInInSystemBrowser() {
  const challenge = await beginNativeHandoff()
  const url = new URL('/auth/native/google', window.location.origin)
  url.searchParams.set('challenge', challenge)
  await Browser.open({ url: url.toString() })
}

async function signInWithGoogle() {
  isLoading.value = true
  errorMessage.value = null
  if (isNativeApp()) {
    await signInInSystemBrowser()
    return
  }
  const { data, error } = await authClient.signIn.social({
    provider: 'google',
    // Google needs a fixed return URL, but the right landing page depends on
    // roles we can't read until the callback has run — /auth/complete resolves
    // it there.
    callbackURL: window.location.origin + '/auth/complete',
    disableRedirect: true,
  })
  if (error) {
    errorMessage.value = error.message ?? 'Failed to sign in with Google'
    isLoading.value = false
    return
  }
  if (data?.url) {
    await navigateTo(forceAccountPicker(data.url), { external: true })
  }
}

// The user closed the browser sheet. If they finished signing in first, the
// plugin is already navigating away; otherwise, offer the button again.
let browserFinished: { remove: () => Promise<void> } | undefined
onMounted(async () => {
  if (isNativeApp()) {
    browserFinished = await Browser.addListener('browserFinished', () => {
      isLoading.value = false
    })
    if (route.query.failed) {
      errorMessage.value = 'Signing in didn\'t finish. Please try again.'
      isLoading.value = false
      return
    }
  }
  await signInWithGoogle()
})
onUnmounted(() => browserFinished?.remove())
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <div
      v-if="isLoading"
      class="flex flex-col items-center gap-3"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 text-primary animate-spin"
      />
      <p class="text-muted text-sm">
        Redirecting to Google…
      </p>
    </div>
    <UCard
      v-else
      class="w-full"
    >
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon
          name="i-lucide-shield"
          class="size-10 text-primary"
        />
        <div class="text-center">
          <h1 class="text-2xl font-bold">
            Staff Login
          </h1>
          <p class="text-muted mt-1 text-sm">
            Sign in with your organization Google account.
          </p>
        </div>
        <UAlert
          v-if="errorMessage"
          color="error"
          icon="i-lucide-info"
          :title="errorMessage"
          class="w-full"
        />
        <UButton
          block
          color="neutral"
          variant="outline"
          icon="i-simple-icons-google"
          :loading="isLoading"
          @click="signInWithGoogle"
        >
          Continue with Google
        </UButton>
        <ULink
          to="/auth/login"
          class="text-muted font-medium text-sm"
        >
          Back to volunteer login
        </ULink>
      </div>
    </UCard>
  </PageContainer>
</template>
