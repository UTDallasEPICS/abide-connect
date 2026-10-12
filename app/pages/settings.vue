<template>
  <DefaultLayout title="Settings">
    <StackLayout :style="{ padding: spacing.lg }">
      <NText variant="h2" text="Settings" :style="{ marginBottom: spacing.sm }" />
      <NText variant="caption" text="Native · Phase 4 (stub)" :style="{ marginBottom: spacing.xl }" />
      <NCard>
        <NText variant="body" text="Profile, preferences, sign out options will be ported here." />
      </NCard>
    </StackLayout>
  </DefaultLayout>
</template>

<script setup lang="ts">
import DefaultLayout from '~/layouts/default.vue'
import { spacing } from 'nuxt-native/runtime/theme.js'
</script>
