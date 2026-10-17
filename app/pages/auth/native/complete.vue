<script setup lang="ts">
import { NATIVE_AUTH_CALLBACK } from '#shared/utils/nativeApp'

/**
 * Where Google returns the native app's sign-in, still in the system browser.
 * The session cookie now lives in this browser, so it's exchanged for a
 * single-use token bound to the app's challenge and handed back to the app
 * through its URL scheme (see server/utils/nativeHandoff.ts).
 *
 * Runs in `onMounted` for the same reason as `/auth/complete`: setup also runs
 * on the server, where `$fetch` forwards no cookies.
 *
 * The redirect to the app is attempted automatically, but Chrome Custom Tabs
 * may refuse a scheme navigation that no tap started, so the button is there
 * for that case — and for anyone who dismissed iOS's "Open in app?" prompt.
 */

definePageMeta({
  layout: 'secondary',
})

const route = useRoute()
const appUrl = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  try {
    const { token } = await $fetch<{ token: string }>('/api/auth/native/handoff', {
      method: 'POST',
      body: { challenge: route.query.challenge },
    })
    const url = new URL(NATIVE_AUTH_CALLBACK)
    url.searchParams.set('token', token)
    appUrl.value = url.toString()
    window.location.href = appUrl.value
  }
  catch {
    errorMessage.value = 'Signing in didn\'t finish. Go back to the app and try again.'
  }
})
</script>

<template>
  <PageContainer
    width="form"
    class="flex flex-1 flex-col items-center justify-center gap-6"
  >
    <UAlert
      v-if="errorMessage"
      color="error"
      icon="i-lucide-info"
      :title="errorMessage"
    />
    <template v-else>
      <p class="text-muted text-sm text-center">
        You're signed in. Returning to Abide Connect…
      </p>
      <UButton
        v-if="appUrl"
        :to="appUrl"
        external
        color="neutral"
      >
        Open Abide Connect
      </UButton>
    </template>
  </PageContainer>
</template>
