<template>
  <DefaultLayout>
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h1" text="Abide Connect" :style="{ marginBottom: spacing.md }" />
        <NText variant="h2" text="Welcome" :style="{ marginBottom: spacing.sm }" />
        <NText variant="body" text="Connecting volunteers with our community through events and outreach." :style="{ marginBottom: spacing.lg }" />
        
        <NCard v-if="!isSignedIn" :style="{ marginBottom: spacing.md }">
          <NText variant="h3" text="Get Started" :style="{ marginBottom: spacing.sm }" />
          <NButton text="Sign in" @tap="goLogin" />
        </NCard>
        
        <NCard v-else :style="{ marginBottom: spacing.md }">
          <NText variant="h3" :text="`Hi ${user?.name || user?.email || 'there'}!`" :style="{ marginBottom: spacing.xs }" />
          <NText variant="caption" :text="roles.length ? `Roles: ${roles.join(', ')}` : 'No roles assigned'" :style="{ marginBottom: spacing.sm }" />
          <NButton text="View Events" @tap="goEvents" />
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
import { useUserRoles } from '~/composables/useUserRoles'

const { to } = useNativeNavigate()
const { session, isSignedIn, user } = useSession()
const { roles } = useUserRoles()

function goLogin() { to('auth_login') }
function goEvents() { to('/events/list') }
</script>
