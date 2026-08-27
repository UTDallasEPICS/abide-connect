<script setup lang="ts">
import { authClient } from '#server/utils/auth-client'

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
 * `forceAccountPicker` below adjust it — better-auth's `signIn.social` takes
 * `scopes`/`loginHint` but has no `prompt` option to pass through.
 * `isLoading` starts true because the redirect begins on mount.
 */

definePageMeta({
  layout: 'secondary',
  backTo: '/auth/login',
})

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

/**
 * iPadOS 13+ reports a desktop Safari user agent, so touch points rather than
 * the UA string are what separate it from a real Mac.
 */
function isMobileDevice() {
  const ua = navigator.userAgent
  if (/Android|iP(hone|ad|od)/i.test(ua)) {
    return true
  }
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
}

/**
 * On mobile, ask Google for the account chooser explicitly.
 *
 * Google only shows it when the choice is ambiguous; a phone signed into a
 * single account skips straight through, which on a staff member's personal
 * phone means signing in as the wrong (personal) account with no visible way
 * to switch. Desktop is left alone — the chooser already appears there often
 * enough, and multiple profiles are the norm.
 *
 * `consent` stays in the list: it's what makes Google re-issue a refresh
 * token, which Calendar sync depends on (see `socialProviders.google` in
 * `server/utils/auth.ts`). `prompt` is a space-delimited set, so asking for
 * the chooser must not drop it.
 */
function forceAccountPicker(url: string) {
  if (!isMobileDevice()) {
    return url
  }
  const target = new URL(url, window.location.origin)
  target.searchParams.set('prompt', 'select_account consent')
  return target.toString()
}

async function signInWithGoogle() {
  isLoading.value = true
  errorMessage.value = null
  const { data, error } = await authClient.signIn.social({
    provider: 'google',
    callbackURL: window.location.origin + '/',
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

onMounted(signInWithGoogle)
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <div
      v-if="!errorMessage"
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
