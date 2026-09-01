<script setup lang="ts">
import { resolveLandingRoute } from '~/lib/landingRoute'

/**
 * Landing spot for the Google OAuth return trip — not a page anyone navigates
 * to on purpose.
 *
 * OAuth needs a fixed `callbackURL` handed to Google before sign-in starts, but
 * which page a user belongs on isn't known until their roles can be read, which
 * is only after the callback has run. So Google returns here and this page makes
 * the decision, the same way the OTP form does with `resolveLandingRoute`.
 *
 * The resolution runs in `onMounted` rather than in setup: Google's redirect is
 * a full page load, so setup also runs on the server, where a bare `$fetch`
 * forwards no cookies and would read the brand-new session as anonymous.
 *
 * `replace: true` keeps this out of history — a back tap should return the user
 * to wherever they started signing in, not bounce them through here again.
 */

definePageMeta({
  layout: 'secondary',
  backTo: '/',
})

const route = useRoute()

onMounted(async () => {
  await navigateTo(await resolveLandingRoute(route.query.redirect), { replace: true })
})
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center"
  >
    <div class="flex flex-col items-center gap-3">
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 text-primary animate-spin"
      />
      <p class="text-muted text-sm">
        Signing you in…
      </p>
    </div>
  </PageContainer>
</template>
