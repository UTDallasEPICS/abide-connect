<script setup lang="ts">
/**
 * Shown when a signed-in user reaches a route their roles don't allow — the
 * native counterpart of the web `unauthorizedPage` in
 * `app/middleware/auth.global.ts`, enforced by `useNativeNavigate`'s guard.
 * Users with no session go to /auth/login instead, so anyone landing here is
 * authenticated but insufficiently privileged.
 *
 * Must stay outside every guarded prefix, or redirecting to it would re-trigger
 * the guard and loop.
 */
import SecondaryLayout from '~/layouts/secondary.vue'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
import { colors, fontSizes, spacing } from 'nuxt-native/runtime/theme.js'

const { to } = useNativeNavigate()

function goHome(): void {
  to('index', { clearHistory: true })
}
</script>

<template>
  <SecondaryLayout title="Not allowed">
    <StackLayout :style="{ padding: spacing.xl }">
      <NText
        variant="h1"
        text="403"
        :style="{ marginBottom: spacing.md, color: colors.textMuted }"
      />
      <NText
        variant="h3"
        text="You don’t have permission to access this page."
        :style="{ marginBottom: spacing.lg }"
      />
      <NText
        variant="body"
        text="If you think this is a mistake, try signing in with the account that has access."
        :style="{ marginBottom: spacing.xl, color: colors.textMuted, fontSize: fontSizes.md }"
      />
      <NButton
        text="Go home"
        @tap="goHome"
      />
    </StackLayout>
  </SecondaryLayout>
</template>
