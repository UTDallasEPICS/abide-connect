<script setup lang="ts">
import { authClient } from '#server/utils/auth-client'

const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

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
    await navigateTo(data.url, { external: true })
  }
}

onMounted(signInWithGoogle)
</script>

<template>
  <div class="flex flex-col items-center justify-center p-8 min-h-screen">
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
      class="w-full max-w-md"
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
  </div>
</template>
