<template>
  <DefaultLayout title="Settings">
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h2" text="Settings" :style="{ marginBottom: spacing.sm }" />
        <NCard>
          <NText variant="body" text="Profile settings and preferences." :style="{ marginBottom: spacing.sm }" />
          <NButton text="Sign in" v-if="!isSignedIn" @tap="goLogin" />
          <NButton text="Sign out" v-else @tap="signOut" variant="outline" />
        </NCard>
      </StackLayout>
    </ScrollView>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
import { useNativeNavigate } from '~/composables/useNativeNavigate'
import { useSession } from '~/composables/useSession'

const { to } = useNativeNavigate()
const { isSignedIn, clear } = useSession()

function goLogin() { to('auth_login') }
function signOut() {
  clear()
  to('index', { clearHistory: true })
}
</script>
