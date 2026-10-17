<script setup lang="ts">
import { authClient } from '#server/utils/auth-client'
import { forceAccountPicker } from '~/lib/googleSignIn'
import { NATIVE_HANDOFF_VALUE } from '#shared/utils/nativeApp'

/**
 * First stop of the native app's Google sign-in, opened by
 * `/auth/staff-login` in the *system browser* rather than the app's WebView
 * (Google blocks OAuth in WebViews). Same bounce as staff-login's web path,
 * except Google returns to `/auth/native/complete`, carrying the app's
 * challenge, instead of `/auth/complete`.
 *
 * The challenge rides in the callback URL rather than in this browser's
 * storage because nothing else survives the round trip through Google
 * reliably; it's a hash, so it's not a secret.
 *
 * Always a phone, so the account chooser is always forced.
 */

definePageMeta({
  layout: 'secondary',
})

const route = useRoute()
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const challenge = route.query.challenge
  if (typeof challenge !== 'string' || !NATIVE_HANDOFF_VALUE.test(challenge)) {
    errorMessage.value = 'This sign-in link is invalid. Go back to the app and try again.'
    return
  }
  const callbackURL = new URL('/auth/native/complete', window.location.origin)
  callbackURL.searchParams.set('challenge', challenge)

  const { data, error } = await authClient.signIn.social({
    provider: 'google',
    callbackURL: callbackURL.toString(),
    disableRedirect: true,
  })
  if (error || !data?.url) {
    errorMessage.value = error?.message ?? 'Failed to sign in with Google'
    return
  }
  await navigateTo(forceAccountPicker(data.url), { external: true })
})
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <UAlert
      v-if="errorMessage"
      color="error"
      icon="i-lucide-info"
      :title="errorMessage"
    />
    <div
      v-else
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
  </PageContainer>
</template>
