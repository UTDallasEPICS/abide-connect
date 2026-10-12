<script setup lang="ts">
/**
 * Home, native.
 *
 * Phase 3 keeps this deliberately small: it exists so the app has a real
 * landing screen that exercises the shell (app bar + bottom tabs), the session
 * and role composables, and sign-out. The full web homepage — event carousel,
 * announcements, the works — is Phase 4; the carousel is a known blocker
 * needing a native replacement.
 */
import { computed, onMounted } from 'vue'
import DefaultLayout from '~/layouts/default.vue'
import { useSession } from '~/composables/useSession'
import { useUserRoles } from '~/composables/useUserRoles'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
import { apiFetch } from '~/lib/api'
import { colors, fontSizes, spacing } from 'nuxt-native/runtime/theme.js'

const { user, isSignedIn, refresh, clear: clearSession } = useSession()
const { roles, refresh: refreshRoles, clear: clearRoles } = useUserRoles()
const router = useNativeNavigate()

onMounted(async () => {
  await refresh()
  if (isSignedIn.value) await refreshRoles()
})

const greeting = computed(() => {
  const name = user.value?.name
  return name ? `Hi, ${name}` : 'You’re signed in'
})

const rolesLabel = computed(() => (
  roles.value.length ? `Roles: ${roles.value.join(', ')}` : 'Roles: none'
))

async function signOut(): Promise<void> {
  // A dead session makes sign-out 401 — the cookie is already inert, so a
  // failure here is not worth blocking the user on.
  await apiFetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {})
  clearSession()
  clearRoles()
  await router.to('auth_login', { clearHistory: true })
}

function goLogin(): void {
  router.to('auth_login')
}
</script>

<template>
  <DefaultLayout title="Abide Connect">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText
        variant="h1"
        text="Abide Connect"
        :style="{ marginBottom: spacing.xs }"
      />
      <NText
        variant="caption"
        text="Native build · Phase 3 shell"
        :style="{ marginBottom: spacing.xl }"
      />

      <NCard v-if="isSignedIn">
        <NText
          variant="h3"
          :text="greeting"
          :style="{ marginBottom: spacing.xs }"
        />
        <NText
          variant="caption"
          :text="user?.email ?? ''"
          :style="{ marginBottom: spacing.md }"
        />
        <NText
          variant="label"
          :text="rolesLabel"
          :style="{ marginBottom: spacing.lg }"
        />
        <NButton
          text="Sign out"
          variant="outline"
          @tap="signOut"
        />
      </NCard>

      <NCard v-else>
        <NText
          variant="h3"
          text="Welcome"
          :style="{ marginBottom: spacing.sm }"
        />
        <NText
          variant="body"
          text="Sign in to see your events, volunteer profile and more."
          :style="{ marginBottom: spacing.lg, color: colors.textMuted, fontSize: fontSizes.md }"
        />
        <NButton
          text="Sign in"
          @tap="goLogin"
        />
      </NCard>
    </StackLayout>
  </DefaultLayout>
</template>
