<template>
  <DefaultLayout title="Volunteer">
    <ScrollView>
      <StackLayout :style="{ padding: spacing.lg }">
        <NText variant="h2" text="Volunteer" :style="{ marginBottom: spacing.sm }" />
        <NText variant="body" text="Manage your volunteer events and profile." :style="{ marginBottom: spacing.md }" />
        <NCard>
          <NText variant="body" text="Your upcoming volunteer assignments will appear here." :style="{ marginBottom: spacing.sm }" />
          <NButton text="View All Events" @tap="goEvents" />
        </NCard>
      </StackLayout>
    </ScrollView>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
import { useNativeNavigate } from '~/composables/useNativeNavigate'

const { to } = useNativeNavigate()
function goEvents() { to('/events/list') }
</script>
