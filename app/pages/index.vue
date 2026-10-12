<template>
  <DefaultLayout>
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h1" text="Abide Connect" :style="{ marginBottom: spacing.xs }" />
        <NText variant="body" text="Serving women in need across Dallas." :style="{ marginBottom: spacing.lg }" />
        
        <NCard v-if="!isSignedIn" :style="{ marginBottom: spacing.md }">
          <NText variant="h3" text="Welcome" :style="{ marginBottom: spacing.sm }" />
          <NText variant="body" text="Sign in to see your events, volunteer profile and more." :style="{ marginBottom: spacing.md }" />
          <NButton text="Sign in" @tap="goLogin" />
        </NCard>
        
        <NCard v-else :style="{ marginBottom: spacing.md }">
          <NText variant="h3" :text="`Hi ${user?.name || user?.email || 'there'}!`" :style="{ marginBottom: spacing.xs }" />
          <NText variant="caption" :text="roles.length ? `Roles: ${roles.join(', ')}` : 'Welcome back'" :style="{ marginBottom: spacing.sm }" />
          <NButton text="View Events" @tap="goEvents" :style="{ marginRight: spacing.sm }" />
        </NCard>
        
        <NCard :style="{ marginBottom: spacing.md }">
          <NText variant="h3" text="Get Involved" :style="{ marginBottom: spacing.sm }" />
          <NText variant="body" text="Volunteer at events and support our mobile clinic." :style="{ marginBottom: spacing.md }" />
          <NButton text="Volunteer Info" @tap="goVolunteer" variant="outline" />
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
const { isSignedIn, user } = useSession()
const { roles } = useUserRoles()

function goLogin() { to('auth_login') }
function goEvents() { to('/events/list') }
function goVolunteer() { to('/volunteer') }
</script>
